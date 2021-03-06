// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import uuidv4 from "uuid/v4";
import browser from "webextension-polyfill";
import { action, computed, observable } from "mobx";
import UiState from "./UiState";
import ModalState from "./ModalState";
import variables from "./Variables";
import PluginManager from "../../../plugin/manager";
import NoResponseError from "../../../errors/no-response";
import { Logger, Channels } from "./Logs";
import { LogTypes } from "../../ui-models/Log";

class PlaybackState {
  @observable runId = "";
  @observable isPlaying = false;
  @observable isStopping = false;
  @observable currentPlayingIndex = 0;
  @observable currentRunningTest = null;
  @observable currentRunningSuite = null;
  @observable commandState = new Map();
  @observable testState = new Map();
  @observable suiteState = new Map();
  @observable finishedTestsCount = 0;
  @observable testsCount = 0;
  @observable failures = 0;
  @observable errors = 0;
  @observable hasFailed = false;
  @observable aborted = false;
  @observable paused = false;
  @observable delay = 0;

  constructor() {
    this.maxDelay = 3000;
    this._testsToRun = [];
    this.runningQueue = [];
    this.logger = new Logger(Channels.PLAYBACK);
  }

  @computed get hasFinishedSuccessfully() {
    return !this.runningQueue.find(({ id }) => (
      this.commandState.get(id) ? this.commandState.get(id).state === PlaybackStates.Failed || this.commandState.get(id).state === PlaybackStates.Fatal : false
    ));
  }

  beforePlaying(play) {
    try {
      UiState._project.addCurrentUrl();
    } catch (e) {} // eslint-disable-line no-empty
    if (UiState.isRecording) {
      ModalState.showAlert({
        title: "Stop recording",
        description: "Are you sure you would like to stop recording, and start playing?",
        confirmLabel: "Playback",
        cancelLabel: "cancel"
      }, (chosePlay) => {
        if (chosePlay) {
          UiState.stopRecording();
          play();
        }
      });
    } else {
      play();
    }
  }

  @action.bound startPlayingSuite() {
    const playSuite = action(() => {
      const { suite } = UiState.selectedTest;
      this.resetState();
      variables.clearVariables();
      this.runId = uuidv4();
      this.currentRunningSuite = suite;
      this._testsToRun = [...suite.tests];
      this.testsCount = this._testsToRun.length;
      PluginManager.emitMessage({
        action: "event",
        event: "suitePlaybackStarted",
        options: {
          runId: this.runId,
          suiteName: this.currentRunningSuite.name,
          projectName: UiState._project.name
        }
      }).then(() => {
        this.playNext();
      });
    });
    this.beforePlaying(playSuite);
  }

  @action.bound startPlaying(command) {
    const playTest = action(() => {
      const { test } = UiState.selectedTest;
      this.resetState();
      variables.clearVariables();
      this.runId = uuidv4();
      this.currentRunningSuite = undefined;
      this.currentRunningTest = test;
      this.testsCount = 1;
      this.currentPlayingIndex = 0;
      if (command && command.constructor.name === "Command") {
        this.currentPlayingIndex = test.commands.indexOf(command);
      }
      this.runningQueue = test.commands.peek();
      const pluginsLogs = {};
      if (PluginManager.plugins.length) this.logger.log("Preparing plugins for test run...");
      PluginManager.emitMessage({
        action: "event",
        event: "playbackStarted",
        options: {
          runId: this.runId,
          testId: this.currentRunningTest.id,
          testName: this.currentRunningTest.name,
          projectName: UiState._project.name
        }
      }, (plugin, resolved) => {
        let log = pluginsLogs[plugin.id];

        if (!log) {
          log = this.logger.log(`Waiting for ${plugin.name} to start...`);
          pluginsLogs[plugin.id] = log;
        }

        if (resolved) {
          log.setStatus(LogTypes.Success);
        }
      }).then(action(() => {
        this.isPlaying = true;
      }));
    });
    this.beforePlaying(playTest);
  }

  @action.bound playCommand(command, jumpToNext) {
    const playCommand = action(() => {
      this.runId = "";
      this.noStatisticsEffects = true;
      this.jumpToNextCommand = jumpToNext;
      this.paused = false;
      this.currentPlayingIndex = 0;
      this.errors = 0;
      this.hasFailed = false;
      this.aborted = false;
      this.currentRunningTest = UiState.selectedTest.test;
      this.runningQueue = [command];
      this.isPlaying = true;
    });
    this.beforePlaying(playCommand);
  }

  @action.bound playNext() {
    if (UiState.selectedTest.suite.isParallel) {
      variables.clearVariables();
    }
    this.currentRunningTest = this._testsToRun.shift();
    UiState.selectTest(this.currentRunningTest, UiState.selectedTest.suite);
    this.runningQueue = this.currentRunningTest.commands.peek();
    this.currentPlayingIndex = 0;
    this.errors = 0;
    this.hasFailed = false;
    PluginManager.emitMessage({
      action: "event",
      event: "playbackStarted",
      options: {
        runId: this.runId,
        testId: this.currentRunningTest.id,
        testName: this.currentRunningTest.name,
        suiteName: this.currentRunningSuite.name,
        projectName: UiState._project.name
      }
    }).then(action(() => {
      this.isPlaying = true;
    }));
  }

  @action.bound stopPlayingGracefully() {
    if (this.isPlaying) {
      this.isStopping = true;
      this.paused = false;
    }
  }

  @action.bound stopPlaying() {
    if (this.isPlaying) {
      this.isStopping = true;
      this.paused = false;
      const pluginsLogs = {};
      return PluginManager.emitMessage({
        action: "event",
        event: "playbackStopped",
        options: {
          runId: this.runId,
          testId: this.currentRunningTest.id,
          testName: this.currentRunningTest.name,
          suiteName: this.currentRunningSuite ? this.currentRunningSuite.name : undefined,
          projectName: UiState._project.name
        }
      }, (plugin, resolved) => {
        let log = pluginsLogs[plugin.id];

        if (!log) {
          log = this.logger.log(`Waiting for ${plugin.name} to finish...`);
          pluginsLogs[plugin.id] = log;
        }

        if (resolved) {
          log.setStatus(LogTypes.Success);
        }
      }).then(action(results => {
        return new Promise((res) => {
          results.forEach(result => {
            if (result.message) {
              if (result instanceof Error) {
                if (!(result instanceof NoResponseError)) {
                  this.logger.error(result.message);
                  if (!this.hasFinishedSuccessfully && !this.hasFailed) {
                    this.hasFailed = true;
                    this.failures++;
                  }
                }
              } else {
                this.logger.log(result.message);
              }
            }
            this.testState.set(this.currentRunningTest.id, this.hasFinishedSuccessfully ? PlaybackStates.Passed : PlaybackStates.Failed);
          });
          this.isPlaying = false;
          this.isStopping = false;
          return res();
        });
      }));
    }
    return Promise.reject("Playback is not running");
  }

  @action.bound abortPlaying(fatalHandled) {
    this.aborted = true;
    this.hasFailed = true;
    this._testsToRun = [];
    fatalHandled || this.commandState.set(this.runningQueue[this.currentPlayingIndex].id, { state: PlaybackStates.Undetermined, message: "Aborting..." });
    this.stopPlayingGracefully();
  }

  @action.bound pause() {
    this.paused = true;
  }

  @action.bound resume() {
    this.paused = false;
  }

  @action.bound break() {
    this.paused = true;
    browser.windows.getCurrent().then(windowInfo => {
      browser.windows.update(windowInfo.id, {
        focused: true
      });
    });
  }

  @action.bound finishPlaying() {
    if (!this.hasFinishedSuccessfully) {
      this.hasFailed = true;
    }
    if (!this.noStatisticsEffects) {
      this.finishedTestsCount++;
      if (!this.hasFinishedSuccessfully) {
        this.hasFailed = true;
        this.failures++;
      }
    }
    this.stopPlaying().then(() => {
      if (this.jumpToNextCommand) {
        UiState.selectNextCommand();
      }
      if (this._testsToRun.length) {
        this.playNext();
      } else if (this.currentRunningSuite) {
        PluginManager.emitMessage({
          action: "event",
          event: "suitePlaybackStopped",
          options: {
            runId: this.runId,
            suiteName: this.currentRunningSuite.name,
            projectName: UiState._project.name
          }
        });
        this.suiteState.set(this.currentRunningSuite.id, !this.hasFailed ? PlaybackStates.Passed : PlaybackStates.Failed);
      }
    });
  }

  @action.bound setPlayingIndex(index) {
    this.currentPlayingIndex = index;
  }

  @action.bound setCommandState(commandId, state, message) {
    if (state === PlaybackStates.Failed || state === PlaybackStates.Fatal) {
      this.errors++;
    }
    if (this.isPlaying) {
      this.commandState.set(commandId, { state, message });
      if (state === PlaybackStates.Fatal) {
        this.abortPlaying(true);
      }
    }
  }

  @action.bound clearCommandStates() {
    this.commandState.clear();
  }

  @action.bound setDelay(delay) {
    this.delay = delay;
  }

  @action.bound resetState() {
    this.clearCommandStates();
    this.currentPlayingIndex = 0;
    this.finishedTestsCount = 0;
    this.noStatisticsEffects = false;
    this.failures = 0;
    this.errors = 0;
    this.hasFailed = false;
    this.aborted = false;
    this.paused = false;
  }
}

export const PlaybackStates = {
  Failed: "failed",
  Fatal: "fatal",
  Passed: "passed",
  Pending: "pending",
  Undetermined: "undetermined"
};

if (!window._playbackState) window._playbackState = new PlaybackState();

export default window._playbackState;
