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

import LocationEmitter from "./location";
import SelectionEmitter from "./selection";

const emitters = {
  open: emitOpen,
  click: emitClick,
  clickAt: emitClick,
  check: emitCheck,
  uncheck: emitUncheck,
  doubleClick: emitDoubleClick,
  doubleClickAt: emitDoubleClick,
  dragAndDropToObject: emitDragAndDrop,
  type: emitType,
  sendKeys: emitSendKeys,
  echo: emitEcho,
  runScript: emitRunScript,
  pause: emitPause,
  verifyChecked: emitVerifyChecked,
  verifyNotChecked: emitVerifyNotChecked,
  verifyEditable: emitVerifyEditable,
  verifyNotEditable: emitVerifyNotEditable,
  verifyElementPresent: emitVerifyElementPresent,
  verifyElementNotPresent: emitVerifyElementNotPresent,
  verifySelectedValue: emitVerifySelectedValue,
  verifyNotSelectedValue: emitVerifyNotSelectedValue,
  verifyValue: emitVerifyValue,
  verifyText: emitVerifyText,
  verifyTitle: emitVerifyTitle,
  verifyNotText: emitVerifyNotText,
  verifySelectedLabel: emitVerifySelectedLabel,
  assertChecked: emitVerifyChecked,
  assertNotChecked: emitVerifyNotChecked,
  assertEditable: emitVerifyEditable,
  assertNotEditable: emitVerifyNotEditable,
  assertElementPresent: emitVerifyElementPresent,
  assertElementNotPresent: emitVerifyElementNotPresent,
  assertSelectedValue: emitVerifySelectedValue,
  assertNotSelectedValue: emitVerifyNotSelectedValue,
  assertValue: emitVerifyValue,
  assertText: emitVerifyText,
  assertTitle: emitVerifyTitle,
  assertSelectedLabel: emitVerifySelectedLabel,
  store: emitStore,
  storeText: emitStoreText,
  storeTitle: emitStoreTitle,
  select: emitSelect,
  addSelection: emitSelect,
  removeSelection: emitSelect,
  selectFrame: emitSelectFrame,
  selectWindow: emitSelectWindow,
  mouseDown: emitMouseDown,
  mouseDownAt: emitMouseDown,
  mouseUp: emitMouseUp,
  mouseUpAt: emitMouseUp,
  mouseMove: emitMouseMove,
  mouseMoveAt: emitMouseMove,
  mouseOver: emitMouseMove,
  mouseOut: emitMouseOut,
  assertAlert: emitAssertAlertAndAccept,
  assertNotText: emitVerifyNotText,
  assertPrompt: emitAssertAlert,
  assertConfirmation: emitAssertAlert,
  webdriverAnswerOnNextPrompt: emitAnswerOnNextPrompt,
  webdriverChooseOkOnNextConfirmation: emitChooseOkOnNextConfirmation,
  webdriverChooseCancelOnNextConfirmation: emitChooseCancelOnNextConfirmation,
  webdriverChooseCancelOnNextPrompt: emitChooseCancelOnNextConfirmation,
  editContent: emitEditContent,
  submit: emitSubmit,
  answerOnNextPrompt: skip,
  chooseCancelOnNextConfirmation: skip,
  chooseCancelOnNextPrompt: skip,
  chooseOkOnNextConfirmation: skip,
  setSpeed: skip
};

export function emit(command) {
  return new Promise(async (res, rej) => {
    if (emitters[command.command]) {
      try {
        // Assertion Error 파트를 찾기 위함
        let result = `\n// command_id: ${command.id}\n`;
        result += await emitters[command.command](command.target, command.value);
        res(result);
      } catch (e) {
        rej(e);
      }
    } else {
      rej(command.command ? `Unknown command ${command.command}` : "Command can not be empty");
    }
  });
}

export function canEmit(commandName) {
  return !!(emitters[commandName]);
}

export default {
  canEmit,
  emit
};

function emitOpen(target) {
  const url = /^(file|http|https):\/\//.test(target) ? `"${target}"` : `BASE_URL + "${target}"`;
  return Promise.resolve(`await driver.get(${url});`);
}

async function emitClick(target) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(target)}));
  await driver.findElement(${await LocationEmitter.emit(target)}).then(element => driver.actions().click(element).perform());
  `);
}

async function emitDoubleClick(target) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(target)}));
  await driver.findElement(${await LocationEmitter.emit(target)}).then(element => driver.actions().doubleClick(element).perform());`);
}

async function emitDragAndDrop(dragged, dropzone) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(dragged)}));
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(dropzone)}));
  await driver.findElement(${await LocationEmitter.emit(dragged)})
    .then(dragged => driver.findElement(${await LocationEmitter.emit(dropzone)}).then(dropzone => driver.actions().dragAndDrop(dragged, dropzone).perform()));`);
}

async function emitType(target, value) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(target)}));
  await driver.findElement(${await LocationEmitter.emit(target)}).then(element => element.clear().then(() => element.sendKeys("${value}")));`);
}

async function emitSendKeys(target, value) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(target)}));await driver.findElement(${await LocationEmitter.emit(target)}).then(element => {driver.actions().click(element).sendKeys(\`${value}\`).perform();});`);
}

async function emitEcho(message) {
  return Promise.resolve(`console.log(\`${message}\`);`);
}

async function emitCheck(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => element.isSelected().then(selected => {if(!selected) { return element.click();}}));`);
}

async function emitUncheck(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
  .then(element => element.isSelected().then(selected => {if(selected) { return element.click();}}));`);
}

async function emitRunScript(script) {
  return Promise.resolve(`await driver.executeScript(\`${script}\`);`);
}

async function emitPause(_, time) {
  return Promise.resolve(`await driver.sleep(${time});`);
}

async function emitVerifyChecked(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
  .then(element => element.isSelected().then(selected => {expect(selected).toBeTruthy();}));`);
}

async function emitVerifyNotChecked(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
  .then(element => element.isSelected().then(selected => {expect(selected).toBeFalsy();}));`);
}

async function emitVerifyEditable(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
  .then(element => 
    element.isEnabled().then(enabled => {
      expect(enabled).toBeTruthy();
      return element.getAttribute("readonly")
        .then(readonly => {
          expect(readonly).toBeFalsy();
        });
    })
  );`);
}

async function emitVerifyNotEditable(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element =>
      element.isEnabled()
        .then(enabled => {
          try {
            expect(enabled).toBeFalsy();
          } catch (e) {
            return element.getAttribute("readonly")
              .then(readonly => {expect(readonly).toBeTruthy();});
          }
        })
    );`);
}

async function emitVerifyElementPresent(locator) {
  return Promise.resolve(`
  await driver.findElements(${await LocationEmitter.emit(locator)})
  .then(elements => {expect(elements.length).toBeGreaterThan(0);});
  `);
}

async function emitVerifyElementNotPresent(locator) {
  return Promise.resolve(`
  await driver.findElements(${await LocationEmitter.emit(locator)})
  .then(elements => {expect(elements.length).toBe(0);});`);
}

async function emitVerifySelectedValue(locator, value) {
  return Promise.resolve(`
  await driver.findElement(${await LocationEmitter.emit(locator)})
  .then(element => {
    return element.getTagName()
      .then(tagName => {
        expect(tagName).toBe("select");
        return element.getAttribute("value")
          .then(selectedValue => {
            expect(selectedValue).toBe("${value}");
          });
      });
  });`);
}

async function emitVerifySelectedLabel(locator, labelValue) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {
      return element.getAttribute("value")
        .then(selectedValue => {
          return element.findElement(By.xpath('option[@value="'+selectedValue+'"]'))
            .then(selectedOption => {
              return selectedOption.getText()
                .then(selectedLabel => {
                  expect(selectedLabel).toBe("${labelValue}");});});});});`)
}

async function emitVerifyNotSelectedValue(locator, value) {
  return Promise.resolve(`
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {
      return element.getTagName()
        .then(tagName => {
          expect(tagName).toBe("select");
          return element.getAttribute("value")
            .then(selectedValue => {
              expect(selectedValue).not.toBe("${value}");});});});`);
}

async function emitVerifyValue(locator, value) {
  return Promise.resolve(`
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {
      return element.getAttribute("value")
        .then(value => {
          expect(value).toBe("${value}");});});`);
}

async function emitVerifyText(locator, text) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {
      return element.getText()
        .then(text => {
          expect(text).toBe(\`${text}\`)});});`);
}

async function emitVerifyNotText(locator, text) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {
      return element.getText()
        .then(text => {expect(text).not.toBe(\`${text}\`)});});`);
}

async function emitVerifyTitle(title) {
  return Promise.resolve(`await driver.getTitle().then(title => {expect(title).toBe(\`${title}\`);});`);
}

async function emitStore(value, varName) {
  return Promise.resolve(`var ${varName} = "${value}";`);
}

async function emitStoreText(locator, varName) {
  return Promise.resolve(`
  var ${varName};
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {
      return element.getText()
        .then(text => {${varName} = text;});});`);
}

async function emitStoreTitle(_, varName) {
  return Promise.resolve(`
  var ${varName};
  await driver.getTitle()
    .then(title => {${varName} = title;});`);
}

async function emitSelect(selectElement, option) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(selectElement)}));
  await driver.findElement(${await LocationEmitter.emit(selectElement)})
    .then(element => {
      return element.findElement(${await SelectionEmitter.emit(option)})
        .then(option => {
          return option.click();});});`);
}

async function emitSelectFrame(frameLocation) {
  if (frameLocation === "relative=top") {
    return Promise.resolve("driver.switchTo().frame();");
  } else if (/^index=/.test(frameLocation)) {
    return Promise.resolve(`driver.switchTo().frame(${frameLocation.split("index=")[1]});`);
  } else {
    return Promise.resolve(`await driver.findElement(${await LocationEmitter.emit(frameLocation)}).then(frame => {driver.switchTo().frame(frame);});`);
  }
}

function emitSelectWindow(windowLocation) {
  if (/^name=/.test(windowLocation)) {
    return Promise.resolve(`driver.switchTo().window("${windowLocation.split("name=")[1]}");`);
  } else {
    return Promise.reject("Can only emit `select window` using name locator");
  }
}

async function emitMouseDown(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {return driver.actions().mouseDown(element).perform();});`);
}

async function emitMouseUp(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {return driver.actions().mouseUp(element).perform();});`);
}

async function emitMouseMove(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {return driver.actions().mouseMove(element).perform();});`);
}

async function emitMouseOut(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => {return driver.actions().mouseMove(element, {x: -1, y: -1}).perform();});`);
}

function emitAssertAlert(alertText) {
  return Promise.resolve(`
  await driver.switchTo().alert()
    .then(alert => {
      return alert.getText()
        .then(text => {expect(text).toBe("${alertText}");});});`);
}

function emitAssertAlertAndAccept(alertText) {
  return Promise.resolve(`await driver.switchTo().alert().then(alert => {return alert.getText().then(text => {expect(text).toBe("${alertText}");alert.accept();});});`);
}

function emitChooseOkOnNextConfirmation() {
  return Promise.resolve("await driver.switchTo().alert().then(alert => {return alert.accept();});");
}

function emitChooseCancelOnNextConfirmation() {
  return Promise.resolve("await driver.switchTo().alert().then(alert => {return alert.dismiss();});");
}

function emitAnswerOnNextPrompt(textToSend) {
  return Promise.resolve(`await driver.switchTo().alert().then(alert => {return alert.sendKeys("${textToSend}").then(() => {alert.accept();});});`);
}

async function emitEditContent(locator, content) {
  return Promise.resolve(`await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => { return driver.executeScript("if(arguments[0].contentEditable === 'true') {arguments[0].innerHTML = '${content}'}", element);});`);
}

async function emitSubmit(locator) {
  return Promise.resolve(`
  await driver.wait(until.elementLocated(${await LocationEmitter.emit(locator)}));
  await driver.findElement(${await LocationEmitter.emit(locator)})
    .then(element => { return element.submit();});`);
}

function skip() {
  return Promise.resolve();
}
