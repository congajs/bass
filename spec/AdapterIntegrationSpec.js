const path = require('path');

const Module = require('module');
const originalLoad = Module._load;

Module._load = function (request, parent) {

    if (request === 'bass') {
        return require(path.resolve('node_modules/bass/index'));
    }

    return originalLoad.apply(this, arguments);
};

const { Bass } = require('bass');

const logger = require('log4js').getLogger();

process.on('unhandledRejection', (reason, p) => {
    console.error(p, reason);
    throw reason;
});

module.exports = (adapter = 'bass-nedb', config = {}) => () => {

    const testData = [
        {email: 'test+1@foo.com', name: 'Test 1'},
        {email: 'test+2@foo.com', name: 'Test 2'},
        {email: 'test+3@foo.com', name: 'Test 3'},
        {email: 'test+4@foo.com', name: 'Test 4'}
    ];

    let bass;
    let session;
    let manager;

    const insertMockData = (num = testData.length, offset = 0) => {
        let i;
        for (i = offset; i < num; i++) {
            const document = manager.createDocument('User', testData[i]);
            manager.persist(document);
        }
        return manager.flush();
    };

    const clearMockData = () => {
        return manager.removeBy('User', {});
    };

    beforeEach(done => {

        bass = new Bass(Object.assign({
            adapters: [
                path.resolve('')
            ],

            logging: { logger },

            connections: {
                default: {
                    adapter: adapter
                }
            },

            managers: {
                default: {
                    adapter: adapter,
                    connection: 'default',
                    documents: [
                        path.join(__dirname, 'data/model')
                    ]
                }
            }
        }, config));

        bass.init().then(() => {

            // NOTE: needed until we can respond to on-connect
            setTimeout(() => {

                session = bass.createSession();
                manager = session.getManager('default');

                done();

            }, 1500);

        });

    });

    describe('create, read, update, delete', () => {

        describe('', () => {

            const mockData = Object.create(testData[2]);

            let documentId, document;

            it('should insert a document', done => {

                const user = manager.createDocument('User', mockData);

                manager.persist(user);
                manager.flush(user).then(() => {
                    expect(user.id).toBeTruthy();
                    expect(user.id.length).toBeGreaterThan(0);
                    documentId = user.id;
                    document = user;
                    done();
                });
            });

            it('should find a document by id field', done => {

                manager.find('User', documentId).then(user => {
                    expect(user).toEqual(jasmine.objectContaining(mockData));
                    done();
                });
            });

            it('should find a document by criteria', done => {

                manager.findOneBy('User', {
                    email: mockData.email,
                    name: mockData.name
                }).then(user => {

                    expect(user).toEqual(jasmine.objectContaining(mockData));
                    done();

                });
            });

            it('should update a single document', done => {

                document.name = 'Updated';
                manager.persist(document);
                manager.flush(document).then(() => {
                    manager.find('User', document.id).then(user => {
                        expect(user.name).toEqual('Updated');
                        done();
                    });
                });
            });

            it('should remove a single document', done => {

                manager.remove(document);
                manager.flush().then(() => {
                    manager.find('User', documentId).then(user => {
                        expect(user).toBeFalsy();
                        done();
                    });
                });
            });

        });

        describe('', () => {

            it('should support find count by', done => {

                manager.findCountBy('User', {}).then(num => {
                    expect(num).toMatch(/^\d+$/);
                    done();
                }).catch(err => {
                    expect(err).toBeUndefined();
                    done();
                });
            });

            it('should remove by with empty criteria', done => {

                insertMockData().then(() => {

                    manager.removeBy('User', {}).then(() => {
                        manager.findCountBy('User', {}).then(num => {
                            expect(num).toEqual(0);
                            done();
                        });
                    });
                });
            });

            it('should remove by with criteria', done => {

                const data = testData[0];
                const user = manager.createDocument('User', data);
                manager.persist(user);
                manager.flush(user).then(() => {

                    const documentId = user.id;

                    manager.removeBy('User', {email: data.email, name: data.name}).then(() => {
                        manager.find('User', documentId).then(user => {

                            expect(user).toBeFalsy();
                            done();

                        });
                    });

                });
            });

            it('should find by with empty criteria and sort', done => {

                insertMockData().then(() => {

                    manager.findBy('User', {}, {name: 1}).then(users => {
                        expect(users.length).toEqual(testData.length);
                        for (let [idx, user] of users.entries()) {
                            expect(user).toEqual(jasmine.objectContaining(testData[idx]));
                        }
                        done();
                    });

                });
            });

            it('should find by with criteria', done => {

                manager.findBy('User', {
                    email: testData[2].email,
                    name: testData[2].name
                }).then(users => {

                    expect(users.length).toBeGreaterThan(0);
                    expect(users[0]).toEqual(jasmine.objectContaining(testData[2]));
                    done();

                });
            });

            it('should find by with criteria, using $in, and sort', done => {

                manager.findBy('User',
                    {email: {'$in': [testData[3].email, testData[2].email]}},
                    {name: 1}
                ).then(users => {
                    expect(users.length).toEqual(2);
                    expect(users[0]).toEqual(jasmine.objectContaining(testData[2]));
                    expect(users[1]).toEqual(jasmine.objectContaining(testData[3]));
                    done();
                });
            });

            it('should CRUD asynchronously', done => {

                // NOTE: mock data is inserted from above command

                clearMockData().then(() => insertMockData().then(() => {
                    let promises = [];

                    // validate the records one by one
                    for (let [idx, data] of testData.entries()) {
                        promises.push(
                            // find the document by criteria
                            manager.findOneBy('User', {
                                email: data.email,
                                name: data.name
                            }).then(document => {
                                expect(document).toEqual(jasmine.objectContaining({
                                    email: data.email,
                                    name: data.name
                                }));
                                // update the document
                                document.email = 'update+' + (idx + 1) + '@foo.com';
                                document.name = 'Update ' + (idx + 1);
                                manager.persist(document);
                                return manager.flush(document).then(() => {

                                    // find the document by id
                                    return manager.find('User', document.id).then(found => {
                                        expect(found).toEqual(jasmine.objectContaining({
                                            email: document.email,
                                            name: document.name
                                        }));

                                        // remove the document
                                        manager.remove(document);
                                        return manager.flush(document);
                                    })
                                })
                            })
                        );
                    }

                    Promise.all(promises).then(data => {

                        Promise.all([
                            manager.findBy('User', {}).then(documents => {
                                expect(documents.length).toEqual(0);
                            }),
                            manager.findCountBy('User', {}).then(num => {
                                expect(num).toEqual(0);
                            })
                        ]).then(() => done());

                    });
                }));
            });

            it('should update by', done => {

                insertMockData().then(() => {

                    const data = testData[3];
                    manager.updateBy(
                        'User',
                        {email: data.email, name: data.name},
                        {email: 'update-by-user@foo.com', name: 'Update By User'}
                    ).then(() => {

                        Promise.all([

                            manager.findOneBy('User', {
                                email: data.email,
                                name: data.name
                            }).then(document => {
                                expect(document).toBeFalsy();
                            }),

                            manager.findOneBy('User', {
                                email: 'update-by-user@foo.com',
                                name: 'Update By User'
                            }).then(document => {

                                expect(document).toEqual(jasmine.objectContaining({
                                    email: 'update-by-user@foo.com',
                                    name: 'Update By User'
                                }));
                            })

                        ]).then(() => done());

                    });

                });
            });

        });

    });

};