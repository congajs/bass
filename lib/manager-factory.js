/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const Manager = require('./manager');

/**
 * The ManagerFactory creates a new Manager from
 * a ManagerDefinition
 *
 * @param  {Registry} registry
 */
class ManagerFactory {

    /**
     *
     * @param {Registry} registry
     */
    constructor(registry) {
        this.registry = registry;
    }

    /**
     * Create a new Manager from a manager definition
     *
     * @param  {String}   name
     * @param  {Session}  session
     * @return {Manager}
     */
    factory(name, session) {
        return new Manager(
            name,
            this.registry.getManagerDefinition(name),
            session
        );
    }
}

module.exports = ManagerFactory;
