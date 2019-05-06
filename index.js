/*
 * DBGp (Common DeBugGer Protocol) TCP client for Node.js
 * Copyright (c) Dan Phillimore (asmblah)
 * https://github.com/uniter/dbgp/
 *
 * Released under the MIT license
 * https://github.com/uniter/dbgp/raw/master/MIT-LICENSE.txt
 */

const ERROR_INVALID_OPTIONS = 3;
const ERROR_UNIMPLEMENTED_COMMAND = 4;
const atob = require('atob');
const btoa = require('btoa');
const events = require('events');
const fileUri = `${__dirname}/example/single_script/php/my_script.php`;
const logger = {
    debug: console.info.bind(console),
    error: console.info.bind(console),
    info: console.info.bind(console)
};
const minimist = require('minimist');
const net = require('net');

module.exports = {
    connect(ip = '127.0.0.1', port = 9000) {
        const eventEmitter = new events.EventEmitter();
        const socket = new net.Socket();
        const sendXml = (xml) => {
            xml = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;

            socket.write(`${xml.length}\x00${xml}\x00`);
        };
        /**
         * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#65-debugger-engine-errors}
         * @param {number} code
         */
        const sendError = (commandName, transactionId, code) => {
            sendXml(
                `<response
                    xmlns="urn:debugger_protocol_v1"
                    xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                    command="${commandName}"
                    transaction_id="${transactionId}"
                >
                    <error code="${code}">
                    </error>
                </response>`
            );
        };
        const handleCommand = (command) => {
            const match = command.match(/^([^\s]+) (.*)$/);
            const commandName = match[1];
            const args = minimist(match[2].split(/\s/), {'--': true});
            const transactionId = args.i;
            let status;

            logger.debug(`Command #${transactionId} from IDE: ${commandName}(${JSON.stringify(args)})`);

            switch (commandName) {
                /**
                 * Sets a breakpoint for the debugging session
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#761-breakpoint_set}
                 */
                case 'breakpoint_set':
                    // logger.debug('FIXME: Not actually setting breakpoint');

                    if (args.t !== 'line') {
                        throw new Error('Only line breakpoints supported');
                    }

                    eventEmitter.emit('line_breakpoint_set', {
                        path: args.f,
                        line: args.n
                    });

                    // FIXME: Need to send a response back here

                    break;
                /**
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#context-get}
                 */
                case 'context_get':
                    const contextId = args.c || 0;
                    let contextProperties = '';

                    logger.debug('FIXME: Making up some context variables');

                    if (contextId === 0) {
                        contextProperties = `
                            <property name="myFirstVar" fullname="myFirstVar" type="bool"><![CDATA[1]]></property>
                        `;
                    }

                    sendXml(
                        `<response
                            xmlns="urn:debugger_protocol_v1"
                            xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                            command="${commandName}"
                            context="${contextId}"
                            transaction_id="${transactionId}"
                        >
                            ${contextProperties}
                        </response>
                        `
                    );
                    break;
                /**
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#79-context_names}
                 */
                case 'context_names':
                    sendXml(
                        `<response
                                xmlns="urn:debugger_protocol_v1"
                                xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                command="${commandName}"
                                transaction_id="${transactionId}"
                            >
                                <context name="Local" id="0" />
                                <context name="Global" id="1" />
                            </response>
                            `
                    );
                    break;
                /**
                 * Evaluate a given string within the current execution context
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#eval}
                 */
                case 'eval':
                    const codeToEval = atob(args['--'][0]);

                    logger.debug(`Evaluating code: ${codeToEval}`);

                    if (
                        codeToEval === 'isset($_SERVER[\'PHP_IDE_CONFIG\'])' ||
                        codeToEval === 'isset($_SERVER[\'SSH_CONNECTION\'])' ||
                        codeToEval === 'isset($_SERVER[\'SERVER_ADDR\'])'
                    ) {
                        sendXml(
                            `<response
                                xmlns="urn:debugger_protocol_v1"
                                xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                command="${commandName}"
                                transaction_id="${transactionId}"
                            >
                                <property type="bool"><![CDATA[0]]></property>
                            </response>
                            `
                        );
                    } else if (codeToEval === 'isset($_SERVER[\'SERVER_NAME\'])') {
                        sendXml(
                            `<response
                                xmlns="urn:debugger_protocol_v1"
                                xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                command="${commandName}"
                                transaction_id="${transactionId}"
                            >
                                <property type="bool"><![CDATA[1]]></property>
                            </response>
                            `
                        );
                    } else if (codeToEval === '(string)($_SERVER[\'SERVER_NAME\'])') {
                        const serverName = '127.0.0.1';

                        sendXml(
                            `<response
                                xmlns="urn:debugger_protocol_v1"
                                xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                command="${commandName}"
                                transaction_id="${transactionId}"
                            >
                                <property type="string" encoding="base64" size="${serverName.length}"><![CDATA[${btoa(serverName)}]]></property>
                            </response>
                            `
                        );
                    } else if (codeToEval === '(string)($_SERVER[\'SERVER_PORT\'])') {
                        const serverPort = 80;

                        sendXml(
                            `<response
                                xmlns="urn:debugger_protocol_v1"
                                xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                command="${commandName}"
                                transaction_id="${transactionId}"
                            >
                                <property type="string" encoding="base64" size="${serverPort.length}">
                                    <![CDATA[${btoa(serverPort)}]]>
                                </property>
                            </response>
                            `
                        );
                    } else if (codeToEval === '(string)($_SERVER[\'REQUEST_URI\'])') {
                        const requestUri = 'https://some.fake.uri';

                        sendXml(
                            `<response
                                xmlns="urn:debugger_protocol_v1"
                                xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                command="${commandName}"
                                transaction_id="${transactionId}"
                            >
                                <property type="string" encoding="base64" size="${requestUri.length}">
                                    <![CDATA[${btoa(requestUri)}]]>
                                </property>
                            </response>
                            `
                        );
                    } else {
                        throw new Error('Full eval support is not available!');
                    }

                    break;
                /**
                 * Configure a debugger feature
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#723-feature_set}
                 */
                case 'feature_set':
                    const featureName = args.n;
                    const featureValue = args.v;

                    switch (featureName) {
                        case 'show_hidden':
                            logger.info(`FIXME: Not really setting feature ${featureName} to ${featureValue}`);

                            sendXml(
                                `<response
                                    xmlns="urn:debugger_protocol_v1"
                                    xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                    command="${commandName}"
                                    feature="${featureName}"
                                    success="1"
                                    transaction_id="${transactionId}" />`
                            );
                            break;
                        default:
                            logger.debug(`Unsupported feature requested: "${featureName}"`);

                            sendError(commandName, transactionId, ERROR_INVALID_OPTIONS);
                    }
                    break;
                /**
                 * Starts or resumes the script until either a new breakpoint or the end of the script is reached
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#75-continuation-commands}
                 */
                case 'run':
                    logger.debug('FIXME: Not actually running');

                    eventEmitter.emit('run');

                    // A response needs to be sent later (not immediately),
                    // when reaching a breakpoint or ending execution for some reason

                    break;
                /**
                 * Get stack information for a given stack depth
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#78-stack_get}
                 */
                case 'stack_get':
                    const frameType = 'file';
                    const frameFile = fileUri;
                    const frameLine = 6;
                    const frameStartColumn = 0;
                    const frameEndColumn = 14;

                    logger.debug('FIXME: Pretending to be on line 6');

                    sendXml(
                        `<response
                            xmlns="urn:debugger_protocol_v1"
                            xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                            command="${commandName}"
                            transaction_id="${transactionId}"
                        >
                            <stack level="0"
                                type="file"
                                filename="${frameFile}"
                                lineno="${frameLine}"
                                where="{main}"
                                cmdbegin="${frameLine}:${frameStartColumn}"
                                cmdend="${frameLine}:${frameEndColumn}"
                            />
                            <stack level="1"
                                type="file"
                                filename="${frameFile}"
                                lineno="${frameLine + 1}"
                                where="dans-fake-stack-frame"
                                cmdbegin="${frameLine}:${frameStartColumn}"
                                cmdend="${frameLine}:${frameEndColumn}"
                            />
                        </response>`
                    );
                    break;
                /**
                 * Get status of the debugger engine
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#71-status}
                 */
                case 'status':
                    status = 'starting';

                    logger.info('FIXME: Pretending to be starting');

                    sendXml(
                        `<response
                            xmlns="urn:debugger_protocol_v1"
                            xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                            command="${commandName}"
                            status="${status}"
                            reason="ok"
                            transaction_id="${transactionId}"
                        ></response>`
                    );

                    break;
                /**
                 * Steps to the next statement: if there is a function call involved
                 * it will break on the first statement in that function.
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#75-continuation-commands}
                 */
                case 'step_into':
                    status = 'break';

                    logger.info('FIXME: Pretending to be paused');

                    sendXml(
                        `<response
                            xmlns="urn:debugger_protocol_v1"
                            xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                            command="${commandName}"
                            status="${status}"
                            reason="ok"
                            transaction_id="${transactionId}"
                        ></response>`
                    );

                    break;
                /**
                 * Set stdout stream redirection
                 *
                 * @see {@link https://github.com/derickr/dbgp/blob/master/debugger_protocol.rst#71-status}
                 */
                case 'stdout':
                    const redirection = args.c;

                    switch (redirection) {
                        case 0:
                            logger.debug('Stdout will be output in regular place, but not sent to the IDE');

                            sendXml(
                                `<response
                                    xmlns="urn:debugger_protocol_v1"
                                    xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                    command="${commandName}"
                                    success="1"
                                    transaction_id="${transactionId}" />`
                            );
                            break;
                        case 1:
                            logger.debug('Stdout will be output in regular place and also sent to the IDE');

                            sendXml(
                                `<response
                                    xmlns="urn:debugger_protocol_v1"
                                    xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                    command="${commandName}"
                                    success="1"
                                    transaction_id="${transactionId}" />`
                            );
                            break;
                        case 2:
                            logger.debug('Stdout will not be output in regular place, only sent to the IDE');

                            sendXml(
                                `<response
                                    xmlns="urn:debugger_protocol_v1"
                                    xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                                    command="${commandName}"
                                    success="1"
                                    transaction_id="${transactionId}" />`
                            );
                            break;
                        default:
                            logger.debug(`Unsupported stdout redirection requested: "${redirection}"`);

                            sendError(commandName, transactionId, ERROR_INVALID_OPTIONS);
                    }

                    break;
                default:
                    logger.error(`Unsupported command from IDE: "${commandName}"`);

                    sendError(commandName, transactionId, ERROR_UNIMPLEMENTED_COMMAND);
            }
        };
        const handleMessage = (message) => {
            const commands = message.replace(/\x00$/, '').split('\x00');

            for (const command of commands) {
                handleCommand(command);
            }
        };

        socket.connect(port, ip, function () {
            logger.debug('Connected');

            sendXml(
                `<init
                    xmlns="urn:debugger_protocol_v1"
                    xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                    fileuri="file://${fileUri}"
                    language="PHP"
                    protocol_version="1.0"
                    appid="13202"
                    idekey="dbgpjstest"
                >
                    <engine version="0.0.1"><![CDATA[DBGp.js]]></engine>
                    <author><![CDATA[Dan Phillimore (asmblah)]]></author>
                    <url><![CDATA[https://github.com/uniter/dbgp]]></url>
                    <copyright><![CDATA[Copyright (c) 2019 by Dan Phillimore]]></copyright>
                </init>`
            );

            setInterval(function () {
                const data = `A random number: ${Math.random()}\n`;

                logger.debug('TEMP: Periodically sending stdout data to IDE');

                sendXml(
                    `
                    <stream
                        xmlns="urn:debugger_protocol_v1"
                        xmlns:xdebug="http://xdebug.org/dbgp/xdebug"
                        type="stdout"
                        size="${data.length}"
                        encoding="base64"
                    >
                        <![CDATA[${btoa(data)}]]>
                    </stream>
                    `
                );
            }, 5000);
        });

        socket.on('data', function (data) {
            const command = data.toString();

            handleMessage(command);

            // socket.destroy(); // kill client after server's response
        });

        socket.on('close', function () {
            logger.debug('Connection closed');
        });

        return {
            on: function (eventName, listener) {
                eventEmitter.on(eventName, listener);
            }
        };
    }
};
