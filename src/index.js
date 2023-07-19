class SCORMConnection {
  constructor(scorm) {
    this.isActive = false;
    this.isInitialised = false;
    this.scorm = scorm;
  }
  initialize() {
    const { API, handleCompletionStatus, version, debug } = this.scorm;
    let success = false;
    const action = 'SCORM.connection.initialize';
    this.log(`${action} called.`);

    if (this.isActive) {
      this.handleError(action, null, 'Aborted: Connection already active.');
      return false;
    }

    const APIHandle = API.getHandle();
    if (!APIHandle) {
      this.handleError(action, null, 'API is null.');
      return false;
    }

    success = this.initializeAPI(APIHandle, version);
    if (success) {
      const errorCode = debug.getCode();
      if (errorCode === 0) {
        this.isActive = true;
        if (handleCompletionStatus) this.handleCompletionStatus();
      } else {
        success = false;
        this.handleError(action, errorCode, 'No response from server.');
        debugger
      }
    } else {
      const errorCode = debug.getCode();
      this.handleError(
        action,
        errorCode,
        errorCode ? 'API failure.' : 'No response from server.'
      );
      debugger
    }

    return success;
  }
  handleError(action, errorCode, message) {
    this.logError(`${action} failed: ${message}`);
    if (errorCode !== null && errorCode !== 0) {
      this.logError(
        `Error code: ${errorCode} Error info: ${this.scorm.debug.getInfo(
          errorCode
        )}`
      );
    }
  }
  handleCompletionStatus() {
    const completionStatus = this.scorm.handleStatus('get');
    if (
      completionStatus &&
      ['not attempted', 'unknown'].includes(completionStatus)
    ) {
      this.scorm.handleStatus('set', 'incomplete');
      this.scorm.saveData();
    }
  }
  initializeAPI(APIHandle, version) {
    switch (version) {
      case '1.2':
        return Boolean(APIHandle.LMSInitialize(''));
      case '2004':
        return Boolean(APIHandle.Initialize(''));
      default:
        return false;
    }
  }
  terminate() {
    const { API, data, handleExitMode, version } = this.scorm;
    const { exitStatus, completionStatus } = data;
    let success = false;
    let errorCode = 0;
    const action = 'SCORM.connection.terminate';

    if (!this.isActive) {
      this.handleError(action, errorCode, 'Connection already terminated.');
      return false;
    }

    const APIHandle = API.getHandle();
    if (!APIHandle) {
      this.handleError(action, errorCode, 'API is null.');
      return false;
    }

    success = this.terminateConnection(
      handleExitMode,
      exitStatus,
      completionStatus,
      version
    );
    if (success) success = this.finishAPI(APIHandle, version);
    this.handleSuccess(action, success, 'No response from server.');
    debugger
    return success;
  }
  handleSuccess(action, success, failureMessage) {
    if (success) {
      this.isActive = false;
    } else {
      this.handleError(action, this.scorm.debug.getCode(), failureMessage);
    }
  }
  terminateConnection(handleExitMode, exitStatus, completionStatus, version) {
    let success = false;
    if (handleExitMode && !exitStatus) {
      const exitVal =
        completionStatus !== 'completed' && completionStatus !== 'passed'
          ? 'suspend'
          : 'logout';
      const key = version === '1.2' ? 'cmi.core.exit' : 'cmi.exit';
      success = this.scorm.setData(key, exitVal);
    }
    if (version === '1.2') success = this.scorm.saveData();
    return success;
  }
  finishAPI(APIHandle, version) {
    return Boolean(
      version === '1.2' ? APIHandle.LMSFinish('') : APIHandle.Terminate('')
    );
  }
  logError(message) {
    console.error(`Connection Error: ${message}`);
  }
  log(message) {
    if (this.isActive) {
      console.log(message);
    }
  }
}

class SCORMAPI {
  constructor(scorm) {
    this.scorm = scorm;
    this.handle = null;
    this.isFound = false;
    this.findAttemptLimit = 500;
  }
  find(win) {
    return this.#APIFind(win);
  }
  get() {
    return this.#getAPI();
  }
  getHandle() {
    return this.#getAPIHandle();
  }
  #log(message) {
    console.log(message);
  }
  #APIFind(win) {
    let API = null;
    let findAttempts = 0;
    while (
      !this.#isAPIFound(win) &&
      findAttempts <= this.findAttemptLimit
    ) {
      findAttempts++;
      win = win.parent;
    }
    API = this.#assignAPI(win);
    if (!API) {
      this.#log(
        `Error finding API. Find attempts: ${findAttempts}. Find attempt limit: ${this.findAttemptLimit}`
      );
    }
    return API;
  }
  #isAPIFound(win) {
    return win.API || win.API_1484_11 || !win.parent || win.parent == win;
  }
  #assignAPI(win) {
    let API = null;
    if (this.scorm.version) {
      API = this.#getAPIByVersion(win);
    } else {
      API = this.#getAPIWithoutVersion(win);
    }
    if (API) {
      this.#log(`API found. Version: ${this.scorm.version}`);
    }
    return API;
  }
  #getAPIByVersion(win) {
    let API = null;
    switch (this.scorm.version) {
      case '2004':
        if (win.API_1484_11) {
          API = win.API_1484_11;
        } else {
          this.#log(
            'SCORM version 2004 was specified by user, but API_1484_11 cannot be found.'
          );
        }
        break;
      case '1.2':
        if (win.API) {
          API = win.API;
        } else {
          this.#log(
            'SCORM version 1.2 was specified by user, but API cannot be found.'
          );
        }
        break;
    }
    return API;
  }
  #getAPIWithoutVersion(win) {
    let API = null;
    if (win.API_1484_11) {
      this.scorm.version = '2004';
      API = win.API_1484_11;
    } else if (win.API) {
      this.scorm.version = '1.2';
      API = win.API;
    }
    return API;
  }
  #getAPI() {
    let API = this.find(window);
    if (!API) {
      API = this.find(window.parent);
    }
    if (!API && window.top.opener) {
      API = this.find(window.top.opener);
    }
    if (!API && window.top.opener?.document) {
      API = this.find(window.top.opener.document);
    }
    if (API) {
      this.isFound = true;
    } else {
      this.#log("API.get failed: Can't find the API!");
    }
    return API;
  }
  #getAPIHandle() {
    if (!this.handle && !this.isFound) {
      this.handle = this.get();
    }
    return this.handle;
  }
}

class SCORMData {
  constructor(scorm) {
    this.scorm = scorm;
    this.completionStatus = null;
    this.exitStatus = null;
  }

  handleError(action, errorCode, message) {
    console.error(`${action} failed: ${message}`);
    if (errorCode !== null && errorCode !== 0) {
      console.error(
        `Error code: ${errorCode} Error info: ${this.scorm.debug.getInfo(
          errorCode
        )}`
      );
    }
  }

  getAPIValue(APIHandle, parameter, version) {
    switch (version) {
      case '1.2':
        return APIHandle.LMSGetValue(parameter);
      case '2004':
        return APIHandle.GetValue(parameter);
      default:
        return null;
    }
  }

  get(parameter) {
    let value = null;
    const action = `SCORM.data.get('${parameter}')`;
    console.log(`${action} called.`);

    if (!this.scorm.connection.isActive) {
      this.handleError(action, null, 'API connection is inactive.');
      return String(value);
    }

    const APIHandle = this.scorm.API.getHandle();
    if (!APIHandle) {
      this.handleError(action, null, 'API is null.');
      return String(value);
    }

    value = this.getAPIValue(APIHandle, parameter, this.scorm.version);

    const errorCode = this.scorm.debug.getCode();
    if (value !== '' || errorCode === 0) {
      switch (parameter) {
        case 'cmi.core.lesson_status':
        case 'cmi.completion_status':
          this.completionStatus = value;
          break;
        case 'cmi.core.exit':
        case 'cmi.exit':
          this.exitStatus = value;
          break;
      }
    } else {
      this.handleError(action, errorCode, 'Getting value failed.');
    }

    console.log(`${action} value: ${value}`);

    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value)) return Number(value);
    return value;
  }

  setAPIValue(APIHandle, parameter, value, version) {
    const stringValue = value.toString();

    switch (version) {
      case '1.2':
        return Boolean(APIHandle.LMSSetValue(parameter, stringValue));
      case '2004':
        return Boolean(APIHandle.SetValue(parameter, stringValue));
      default:
        return false;
    }
  }

  set(parameter, value) {
    let success = false;
    const action = `SCORM.data.set('${parameter}')`;
    console.log(`${action} called.`);

    if (!this.scorm.connection.isActive) {
      this.handleError(action, null, 'API connection is inactive.');
      return success;
    }

    const APIHandle = this.scorm.API.getHandle();
    if (!APIHandle) {
      this.handleError(action, null, 'API is null.');
      return success;
    }

    success = this.setAPIValue(APIHandle, parameter, value, this.scorm.version);

    if (success) {
      if (
        ['cmi.core.lesson_status', 'cmi.completion_status'].includes(parameter)
      ) {
        this.completionStatus = value.toString();
      }
    } else {
      const errorCode = this.scorm.debug.getCode();
      this.handleError(action, errorCode, 'Setting value failed.');
    }

    console.log(`${action} value: ${value}`);

    return success;
  }

  commitAPI(APIHandle, version) {
    switch (version) {
      case '1.2':
        return Boolean(APIHandle.LMSCommit(''));
      case '2004':
        return Boolean(APIHandle.Commit(''));
      default:
        return false;
    }
  }

  save() {
    let success = false;
    const action = 'SCORM.data.save';
    console.log(`${action} called.`);

    if (!this.scorm.connection.isActive) {
      this.handleError(action, 'API connection is inactive.');
      return success;
    }

    const APIHandle = this.scorm.API.getHandle();
    if (!APIHandle) {
      this.handleError(action, 'API is null.');
      return success;
    }

    success = this.commitAPI(APIHandle, this.scorm.version);

    return success;
  }

  status(action, status) {
    let success = false;
    const traceMsgPrefix = 'SCORM.status failed';

    let cmi = '';
    switch (this.scorm.version) {
      case '1.2':
        cmi = 'cmi.core.lesson_status';
        break;
      case '2004':
        cmi = 'cmi.completion_status';
        break;
      default:
        console.error(
          `${traceMsgPrefix}: No valid SCORM version was specified.`
        );
        return success;
    }

    if (!action) {
      console.error(`${traceMsgPrefix}: Action was not specified.`);
      return success;
    }

    switch (action) {
      case 'get':
        success = this.get(cmi);
        break;
      case 'set':
        if (!status) {
          console.error(`${traceMsgPrefix}: Status was not specified.`);
        } else {
          success = this.set(cmi, status);
        }
        break;
      default:
        console.error(`${traceMsgPrefix}: No valid action was specified.`);
    }

    return success;
  }
}

class SCORMDebug {
  constructor(scorm) {
    this.scorm = scorm;
  }

  getCode() {
    const { API, version } = this.scorm;
    const action = 'SCORM.debug.getCode';
    let code = 0;

    console.log(`${action} called.`);

    if (!API.getHandle()) {
      this.handleError(action, 'API is null.');
      return code;
    }

    switch (version) {
      case '1.2':
        code = parseInt(API.getHandle().LMSGetLastError(), 10);
        break;
      case '2004':
        code = parseInt(API.getHandle().GetLastError(), 10);
        break;
    }

    return code;
  }

  getInfo(errorCode) {
    const { API, version } = this.scorm;
    const action = 'SCORM.debug.getInfo';
    let result = '';

    console.log(`${action} called.`);

    if (!API.getHandle()) {
      this.handleError(action, 'API is null.');
      return String(result);
    }

    switch (version) {
      case '1.2':
        result = API.getHandle().LMSGetErrorString(errorCode.toString());
        break;
      case '2004':
        result = API.getHandle().GetErrorString(errorCode.toString());
        break;
    }

    return String(result);
  }

  getDiagnosticInfo(errorCode) {
    const { API, version } = this.scorm;
    const action = 'SCORM.debug.getDiagnosticInfo';
    let result = '';

    console.log(`${action} called.`);

    if (!API.getHandle()) {
      this.handleError(action, 'API is null.');
      return String(result);
    }

    switch (version) {
      case '1.2':
        result = API.getHandle().LMSGetDiagnostic(errorCode);
        break;
      case '2004':
        result = API.getHandle().GetDiagnostic(errorCode);
        break;
    }

    return String(result);
  }

  handleError(action, message) {
    console.error(`${action} failed: ${message}`);
  }
}

export default class Aztar {
  constructor() {
    this.UTILS = {};
    this.debug = { isActive: true };
    let SCORM = {
      version: null,
      handleCompletionStatus: true,
      handleExitMode: true,
    };

    SCORM.API = new SCORMAPI(SCORM);
    SCORM.data = new SCORMData(SCORM);
    SCORM.debug = new SCORMDebug(SCORM);
    SCORM.connection = new SCORMConnection(SCORM);

    // Finalize SCORM with isAvailable
    SCORM = {
      ...SCORM,
      get isAvailable() {
        return this.API.handle !== null;
      },
    };

    // Assign the fully constructed SCORM to this.SCORM
    this.SCORM = SCORM;
  }

  initializeConnection() {
    this.SCORM.connection.initialize();
  }
  terminateConnection() {
    this.SCORM.connection.terminate();
  }
  isConnectionActive() {
    return this.SCORM.connection.isActive;
  }
  getData(dataModel) {
    return this.SCORM.data.get(dataModel);
  }
  setData(dataModel, value) {
    return this.SCORM.data.set(dataModel, value);
  }
  saveData() {
    return this.SCORM.data.save();
  }
  handleStatus(action, status) {
    return this.SCORM.data.status(action, status);
  }
  getLastError() {
    return this.SCORM.debug.getCode();
  }
  getErrorString(errorCode) {
    return this.SCORM.debug.getInfo(errorCode);
  }
  getDiagnostic(errorCode) {
    return this.SCORM.debug.getDiagnosticInfo(errorCode);
  }
  handleError(action, message) {
    this.SCORM.debug.handleError(action, message);
  }
}
