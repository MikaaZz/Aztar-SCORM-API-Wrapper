# Aztar SCORM Wrapper

Aztar is a simple JavaScript library providing an API for SCORM communications between a web-based SCO and a SCORM-compliant LMS. The library is based on the SCORM API wrapper by Pipwerks and adapted to be used in modern JavaScript development.

## Installation

```
npm i aztar-scorm-api-wrapper
```

or

```
yarn add aztar-scorm-api-wrapper
```

## Usage

First, import the package:

```
import Aztar from 'aztar-scorm-api-wrapper';`
```

## Connection Methods

### Initialize Connection

To start a new SCORM session:

```
Aztar.initialize();
```

### Terminate Connection

To end the current SCORM session:

```
Aztar.terminate();
```

## Data Methods

### Get data from LMS

```
const value = Aztar.get("cmi.core.student_name");
```

### Set data to LMS

```
Aztar.set("cmi.core.score.raw", "100");
```

### Save data

To persist the data with the LMS:

```
let success = Aztar.save();
```

### Status Methods

To set or get the completion status:

```
let success = Aztar.status("set", "completed");
let status = Aztar.status("get");
```

## Debug Methods

These methods are used to access error information when a SCORM error is thrown.

### Get error code

```
let code = Aztar.debugGetCode();
```

### Get error description

```
let info = Aztar.debugGetInfo(code);
```

### Get diagnostic info

```
let diagnosticInfo = Aztar.debugGetDiagnosticInfo(code);
```

## Utils Methods

### StringToBoolean

Converts 'boolean strings' into actual valid booleans.

```
let bool = Aztar.stringToBoolean("true");
```

### Trace

Used for debugging. If debugging is active, it will log the messages in console.

```
Aztar.trace("This is a debug message.");
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT
