/*
 * This file is part of the bass library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

module.exports = class IdStrategy {

    constructor(format) {
        this.format = format;

        this.commands = {

            pid: function() {
                // the process id node is running on
                var pid = process.pid.toString();
                var len = pid.length;
                while (len < 4) {
                    pid += '0';
                    len++;
                }
                return parseInt(pid, 10);
            } ,

            time: function() {
                // microtime
                return Math.floor(new Date() / 1000);
            } ,

            random: function() {
                // random 6 characters
                return (Math.floor(Math.random() * (999999 - 100000)) + 100000);
            }

        };
    }

    generate() {

        let id = '';
        const self = this;

        this.format.split('-').forEach(function(part) {
            if (part.charAt(0) === '{' && part.charAt(part.length - 1) === '}') {
                part = part.substr(1, part.length - 2);
                if (typeof self.commands[part] === 'function') {
                    id += self.commands[part]();
                } else {
                    throw new Error('Invalid Id Strategy ' + self.format + '; Failed to parse ' + part);
                }
            } else {
                id += part;
            }
        });

        if (id.length !== 0) {
            return id;
        }

        return undefined;
    }
}
