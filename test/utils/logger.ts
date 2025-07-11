import { createLogger, format, transports } from 'winston';

export const createForkLogger = (forkName: string) => {
	return createLogger({
		level: 'info',
		format: format.combine(
			format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
			format.printf(
				({ timestamp, level, message }) => `[${timestamp}] [${level}] ${message}`,
			),
		),
		transports: [
			new transports.File({
				filename: `./logs/${forkName}-node.log`,
				level: 'info',
				options: { flags: 'w' }, // Clears the file each time the logger is initialized
			}),
			// Uncomment to log to console
			// new transports.Console({
			//   format: format.combine(format.colorize(), format.simple()),// }),
		],
	});
};
