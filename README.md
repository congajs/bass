# bass.js

Warning!!! This is currently in an experimental pre-release state and may not work! :D

bass.js is an Object Relational Document Manager for nodejs which abstracts the persistence
of objects across different NoSQL engines.

It is based on Entity Manager persistence libraries such as Doctrine2, Hibernate, Java JPA.

The object representations of data are mapped using the [@conga/annotations](https://github.com/congajs/conga-annotations) library.

## Installation

    > npm install bass

## Usage

### Install an adapter

Install one of the available adapters:

    > npm install bass-mongodb

### Configuration

#### Create main configuration for bass

The following configuration is an example using the bass-mongodb adapter.

    var config = {

        // register bass.js adapter(s)
        adapters: [
            '/path/to/node_modules/bass-mongodb'
        ],

        // configure connection info
        connections: {
            'mongodb.default': {
                adapter: 'bass-mongodb', // name of adapter
                database: 'bass-test',
                host: '127.0.0.1',
                port: 27017
            }
        },

        // configure the managers
        managers: {
            'mongodb.default' : {
                adapter: 'bass-mongodb',
                connection: 'mongodb.default',
                documents: {
                    "test": path.join(__dirname, 'document') // directory of annotated document classes
                }
            }
        }
    };

    ##### Additional Initializers:

    ###### poolSize: The number of connections in the pool.
    ###### poolName: String value used to create seperate connection pools within a single bass instance.
    ###### auto-connect: 0 | 1 - If 1 a default connection is created when the bass manager is created.
    ###### auto-reconnect: If the a connection in the pool is lost the driver ensures that a replacement is created.
    

#### Create document classes

    /**
     * @Bass:Document(collection="users", repository="../repository/user")
     */
    function User(){};

    User.prototype = {

        /**
         * @Bass:Id
         * @Bass:Field(type="ObjectID", name="_id")
         */
        id: null,
        
        /**
         * @Bass:Field(type="string", name="name")
         */
        name: null,

        /**
         * @Bass:Field(type="String", name="email")
         */
        email: null,

        /**
         * @Bass:Field(type="Object", name="preferences")
         */
        preferences: {},
        
        /**
         * @Bass:Field(type="Boolean", name="is_active")
         */
        isActive: true,

        /**
         * @Bass:OneToMany(document="Post", orderBy="id")
         */
        posts: [],

        /**
         * @Bass:OneToOne(document="Profile", name="profile_id")
         * @type {Profile}
         */
        profile: null,

        /**
         * @Bass:Version
         * @Bass:Field(type="Number", name="version")
         */
        version: 0,

        /**
         * @Bass:CreatedAt
         * @Field(type="Date", name="created_at")
         */
        createdAt: null,

        /**
         * @Bass:UpdatedAt
         * @Field(type="Date", name="updated_at")
         */
        updatedAt: null,

        /**
         * Say hello!
         * @return {String}
         */
        sayHi: function(){
            return 'Hi, my name is ' + this.name;
        }
    };

    module.exports = User;

#### Initialize bass.js

    var Bass = require('bass');

    // create bass.js instance with a config object
    var bass = new Bass(config);

    bass.init()
        .then(function(){
            // ready to do some cool stuff!!!
        },
        function(error){
            // crap, something went wrong!!!
        });


#### Insert documents

    bass.init()
        .then(function(){

            // create a new session
            var session = bass.createSession();

            // get a manager instance
            var manager = session.getManager('mongodb.default');

            // create some documents
            var charles = manager.createDocument('User', { name : 'Charles Mingus' } );
            var flea = manager.createDocument('User', { name : 'Flea' } );
            var jaco = manager.createDocument('User', { name : 'Jaco Pastorius' } );

            // schedule document insertions
            manager.persist(charles);
            manager.persist(flea);
            manager.persist(jaco);

            // flush the manager's unit of work
            manager.flush()
                .then(function(){
                    console.log(charles.id);
                    // 519eee4a3e6cc7260a000001
                },
                function(error){

                })
        });

#### Retrieving documents

    // retrieve a document by it's id
    manager.getRepository('User').find('519eee4a3e6cc7260a000001')
        .then(function(user){
            console.log(user);
        });

    // retrieve multiple documents
    manager.getRepository('User')
        .findBy(
            { isActive : true }, // conditions
            { id : 1 },          // sort
            0,                   // skip
            20                   // limit
        )
        .then(function(users){
            console.log(users);
        });

#### Remove documents

    // remove loaded documents
    manager.remove(user1);
    manager.remove(user2);

    manager.flush().then(function(){ // ... });




