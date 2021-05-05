/**
 * Logger is a singleton class that implements a logging service
 * that adapts the Console component and the Javascript Console
 * for decoupled communication
 * @class Logger
 */
export default class Logger {

	constructor() {
		if (Logger.instance) {
			return Logger.instance
		}
		Logger.instance = this;

		// renderer = component;

		// sendingToConsole = false;
	}

	log(x) {
		if (sendingToConsole) console.log(x)
		renderer.append = x
    sessionStorage.console += x;
	}

	warn(x) {
		if (sendingToConsole) console.warn(x)
		renderer.append = x
    sessionStorage.console += x;
	}

	info(x) {
		if (sendingToConsole) console.info(x)
    sessionStorage.console += x;
	}

	error(x) {
		if (sendingToConsole) console.info(x)
    sessionStorage.console += x;
	}
}
