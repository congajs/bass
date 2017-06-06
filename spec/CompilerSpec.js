const path = require('path');

const Compiler = require('../lib/compiler');
const Logger = require('../lib/logger/Logger');

const MyCustomAnnotationHandler = require('./data/annotation/MyCustomAnnotationHandler');

const Module = require('module');
const originalLoad = Module._load;

Module._load = function (request, parent) {

	if (request === 'bass') {
		return require('../index');
	}

	return originalLoad.apply(this, arguments);
};


describe("Compiler", () => {

    let compiler;

    beforeAll(() => {

        compiler = new Compiler({

            "adapters": [
                "bass-nedb"
            ],

            "logging": {
                "logger": new Logger()
            },

            "connections": {
                "default": {
                    "adapter": "bass-nedb"
                }
            },

            "managers": {
                "default": {
                    "adapter": "bass-nedb",
                    "connection": "default",
                    "documents": [
                        path.join(__dirname, 'data', 'model')
                    ]
                }
            },

            "annotation": {
                "handlers": [
                    new MyCustomAnnotationHandler()
                ]
            }
        });


    });

    it('should compile', (done) => {
        compiler.compile((err) => {
            expect(err).toEqual(null);
            done();
        });
    });

});
