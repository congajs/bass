const path = require('path');

const Bass = require('../lib/bass');

const Module = require('module');
const originalLoad = Module._load;

Module._load = function (request, parent) {

	if (request === 'bass') {
		return require('../index');
	}

	return originalLoad.apply(this, arguments);
};


describe("Init", () => {

    let bass;

    beforeAll(() => {

        bass = new Bass({

            "adapters": [
                "bass-nedb"
            ],

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
            }

        });


    });

    it('should init', (done) => {
        bass.init().then(() => {
            expect(true).toEqual(true);
            done();
        });
    });

});
