export default class Aztar {
  constructor() {
    this.UTILS = {};
    this.debug = { isActive: true };
    this.SCORM = {
      version: null,
      handleCompletionStatus: true,
      handleExitMode: true,
      API: {
        handle: null,
        isFound: false,
        find(win) {
          let API = null;
          let findAttempts = 0;
          const findAttemptLimit = 500;

          while (
            !win.API &&
            !win.API_1484_11 &&
            win.parent &&
            win.parent != win &&
            findAttempts <= findAttemptLimit
          ) {
            findAttempts++;
            win = win.parent;
          }

          if (this.version) {
            switch (this.version) {
              case '2004':
                if (win.API_1484_11) {
                  API = win.API_1484_11;
                } else {
                  console.log(
                    'SCORM version 2004 was specified by user, but API_1484_11 cannot be found.'
                  );
                }
                break;

              case '1.2':
                if (win.API) {
                  API = win.API;
                } else {
                  console.log(
                    'SCORM version 1.2 was specified by user, but API cannot be found.'
                  );
                }
                break;
            }
          } else {
            if (win.API_1484_11) {
              this.version = '2004';
              API = win.API_1484_11;
            } else if (win.API) {
              this.version = '1.2';
              API = win.API;
            }
          }

          if (API) {
            console.log(`API found. Version: ${this.version}`);
          } else {
            console.log(
              `Error finding API. Find attempts: ${findAttempts}. Find attempt limit: ${findAttemptLimit}`
            );
          }

          return API;
        },
        get() {
          let API = this.find(window);

          if (!API && window.parent && window.parent != window) {
            API = this.find(window.parent);
          }

          if (!API && window.top && window.top.opener) {
            API = this.find(window.top.opener);
          }

          if (
            !API &&
            window.top &&
            window.top.opener &&
            window.top.opener.document
          ) {
            API = this.find(window.top.opener.document);
          }

          if (API) {
            this.isFound = true;
          } else {
            console.log("API.get failed: Can't find the API!");
          }
          return API;
        },
        getHandle() {
          if (!this.handle && !this.isFound) {
            this.handle = this.get();
          }
          return this.handle;
        },
      },
      connection: {
        isActive: false,
        initialize() {
          const { API, data, handleCompletionStatus, version, debug } =
            this.SCORM;
          let success = false;
          const action = 'SCORM.connection.initialize';
          console.log(`${action} called.`);

          const handleError = (errorCode, message) => {
            console.error(`${action} failed: ${message}`);
            if (errorCode !== null && errorCode !== 0) {
              console.error(
                `Error code: ${errorCode} Error info: ${debug.getInfo(
                  errorCode
                )}`
              );
            }
          };

          const initializeAPI = (APIHandle, version) => {
            switch (version) {
              case '1.2':
                return Boolean(APIHandle.LMSInitialize(''));
              case '2004':
                return Boolean(APIHandle.Initialize(''));
              default:
                return false;
            }
          };

          if (this.isActive) {
            handleError(null, 'Aborted: Connection already active.');
            return false;
          }

          const APIHandle = API.getHandle();
          if (!APIHandle) {
            handleError(null, 'API is null.');
            return false;
          }

          success = initializeAPI(APIHandle, version);
          if (success) {
            const errorCode = debug.getCode();
            if (errorCode === 0) {
              this.isActive = true;

              if (handleCompletionStatus) {
                const completionStatus = this.SCORM.status('get');
                if (
                  completionStatus &&
                  ['not attempted', 'unknown'].includes(completionStatus)
                ) {
                  this.SCORM.status('set', 'incomplete');
                  this.SCORM.save();
                }
              }
            } else {
              success = false;
              handleError(errorCode, 'No response from server.');
            }
          } else {
            const errorCode = debug.getCode();
            handleError(
              errorCode,
              errorCode ? 'API failure.' : 'No response from server.'
            );
          }

          return success;
        },
        terminate() {
          const { API, data, handleExitMode, version, debug } = this.SCORM;
          const { exitStatus, completionStatus } = data;
          let success = false;
          let errorCode = 0;
          const action = 'SCORM.connection.terminate';

          const handleError = (message) => {
            console.error(`${action} failed: ${message}`);
            if (errorCode) {
              console.error(
                `Error code: ${errorCode} Error info: ${debug.getInfo(
                  errorCode
                )}`
              );
            }
          };

          const handleSuccess = (success, failureMessage) => {
            if (success) {
              this.isActive = false;
            } else {
              errorCode = debug.getCode();
              handleError(failureMessage);
            }
          };

          if (!this.isActive) {
            handleError('Connection already terminated.');
            return false;
          }

          const APIHandle = API.getHandle();
          if (!APIHandle) {
            handleError('API is null.');
            return false;
          }

          if (handleExitMode && !exitStatus) {
            const exitVal =
              completionStatus !== 'completed' && completionStatus !== 'passed'
                ? 'suspend'
                : 'logout';
            const key = version === '1.2' ? 'cmi.core.exit' : 'cmi.exit';
            success = this.SCORM.set(key, exitVal);
          }

          if (version === '1.2') success = this.SCORM.save();

          if (success) {
            success = Boolean(
              version === '1.2'
                ? APIHandle.LMSFinish('')
                : APIHandle.Terminate('')
            );
            handleSuccess(success, 'No response from server.');
          }

          return success;
        },
      },
      data: {
        completionStatus: null,
        exitStatus: null,
        get: function (parameter) {
          const { API, connection, version, debug } = this.SCORM;
          let value = null;
          const action = `SCORM.data.get('${parameter}')`;

          console.log(`${action} called.`);

          const handleError = (errorCode, message) => {
            console.error(`${action} failed: ${message}`);
            if (errorCode !== null && errorCode !== 0) {
              console.error(
                `Error code: ${errorCode} Error info: ${debug.getInfo(
                  errorCode
                )}`
              );
            }
          };

          const getAPIValue = (APIHandle, parameter, version) => {
            switch (version) {
              case '1.2':
                return APIHandle.LMSGetValue(parameter);
              case '2004':
                return APIHandle.GetValue(parameter);
              default:
                return null;
            }
          };

          if (!connection.isActive) {
            handleError(null, 'API connection is inactive.');
            return String(value);
          }

          const APIHandle = API.getHandle();
          if (!APIHandle) {
            handleError(null, 'API is null.');
            return String(value);
          }

          value = getAPIValue(APIHandle, parameter, version);

          const errorCode = debug.getCode();
          if (value !== '' || errorCode === 0) {
            switch (parameter) {
              case 'cmi.core.lesson_status':
              case 'cmi.completion_status':
                this.SCORM.data.completionStatus = value;
                break;
              case 'cmi.core.exit':
              case 'cmi.exit':
                this.SCORM.data.exitStatus = value;
                break;
            }
          } else {
            handleError(errorCode, 'Getting value failed.');
          }

          console.log(`${action} value: ${value}`);

          if (value === 'true') return true;
          if (value === 'false') return false;
          if (!isNaN(value)) return Number(value);
          return value;
        },
        set: function (parameter, value) {
          const { API, connection, version, debug } = this.SCORM;
          let success = false;
          const action = `SCORM.data.set('${parameter}')`;

          console.log(`${action} called.`);

          const handleError = (errorCode, message) => {
            console.error(`${action} failed: ${message}`);
            if (errorCode !== null && errorCode !== 0) {
              console.error(
                `Error code: ${errorCode} Error info: ${debug.getInfo(
                  errorCode
                )}`
              );
            }
          };

          const setAPIValue = (APIHandle, parameter, value, version) => {
            const stringValue = value.toString();

            switch (version) {
              case '1.2':
                return Boolean(APIHandle.LMSSetValue(parameter, stringValue));
              case '2004':
                return Boolean(APIHandle.SetValue(parameter, stringValue));
              default:
                return false;
            }
          };

          if (!connection.isActive) {
            handleError(null, 'API connection is inactive.');
            return success;
          }

          const APIHandle = API.getHandle();
          if (!APIHandle) {
            handleError(null, 'API is null.');
            return success;
          }

          success = setAPIValue(APIHandle, parameter, value, version);

          if (success) {
            if (
              ['cmi.core.lesson_status', 'cmi.completion_status'].includes(
                parameter
              )
            ) {
              this.SCORM.data.completionStatus = value.toString();
            }
          } else {
            const errorCode = debug.getCode();
            handleError(errorCode, 'Setting value failed.');
          }

          console.log(`${action} value: ${value}`);

          return success;
        },
        save: function () {
          const { API, connection, version } = this.SCORM;
          let success = false;
          const action = 'SCORM.data.save';

          console.log(`${action} called.`);

          const handleError = (message) => {
            console.error(`${action} failed: ${message}`);
          };

          const commitAPI = (APIHandle, version) => {
            switch (version) {
              case '1.2':
                return Boolean(APIHandle.LMSCommit(''));
              case '2004':
                return Boolean(APIHandle.Commit(''));
              default:
                return false;
            }
          };

          if (!connection.isActive) {
            handleError('API connection is inactive.');
            return success;
          }

          const APIHandle = API.getHandle();
          if (!APIHandle) {
            handleError('API is null.');
            return success;
          }

          success = commitAPI(APIHandle, version);

          return success;
        },
        status: function (action, status) {
          const { SCORM } = this;
          let success = false;
          const traceMsgPrefix = 'SCORM.status failed';

          const handleError = (message) => {
            console.error(`${traceMsgPrefix}: ${message}`);
          };

          let cmi = '';
          switch (SCORM.version) {
            case '1.2':
              cmi = 'cmi.core.lesson_status';
              break;
            case '2004':
              cmi = 'cmi.completion_status';
              break;
            default:
              handleError('No valid SCORM version was specified.');
              return success;
          }

          if (!action) {
            handleError('Action was not specified.');
            return success;
          }

          switch (action) {
            case 'get':
              success = this.get(cmi);
              break;
            case 'set':
              if (!status) {
                handleError('Status was not specified.');
              } else {
                success = this.set(cmi, status);
              }
              break;
            default:
              handleError('No valid action was specified.');
          }

          return success;
        },
      },
      debug: {
        getCode: function () {
          const { API, version } = this.SCORM;
          const action = 'SCORM.debug.getCode';
          let code = 0;

          console.log(`${action} called.`);

          const handleError = (message) => {
            console.error(`${action} failed: ${message}`);
          };

          if (!API.getHandle()) {
            handleError('API is null.');
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
        },
        getInfo: function (errorCode) {
          const { API, version } = this.SCORM;
          const action = 'SCORM.debug.getInfo';
          let result = '';

          console.log(`${action} called.`);

          const handleError = (message) => {
            console.error(`${action} failed: ${message}`);
          };

          if (!API.getHandle()) {
            handleError('API is null.');
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
        },
        getDiagnosticInfo: function (errorCode) {
          const { API, version } = this.SCORM;
          const action = 'SCORM.debug.getDiagnosticInfo';
          let result = '';

          console.log(`${action} called.`);

          const handleError = (message) => {
            console.error(`${action} failed: ${message}`);
          };

          if (!API.getHandle()) {
            handleError('API is null.');
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
        },
      },
      get isAvailable() {
        return this.API.handle !== null;
      },
    };
    this.init = this.SCORM.connection.initialize;
    this.finish = this.SCORM.connection.terminate;
    this.get = this.SCORM.data.get;
    this.set = this.SCORM.data.set;
    this.save = this.SCORM.data.save;
    this.status = this.SCORM.status;
    this.debug = this.SCORM.debug;
  }
  static stringToBoolean(value) {
    var t = typeof value;
    switch (t) {
      case 'object':
      case 'string':
        return /(true|1)/i.test(value);
      case 'number':
        return !!value;
      case 'boolean':
        return value;
      case 'undefined':
        return null;
      default:
        return false;
    }
  }
  static trace(msg) {
    if (this.debug.isActive) {
      if (window.console && window.console.log) {
        window.console.log(msg);
      } else {
        //alert(msg);
      }
    }
  }
}
const scorm = new Aztar();
console.log(scorm);
