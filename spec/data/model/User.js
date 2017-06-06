/**
 * @Bass:Document(collection="users")
 */
module.exports = class User {

    constructor() {

        /**
         * @Bass:Id
         * @Bass:Field(type="ObjectID", name="_id")
         */
        this.id = null;

        /**
         * @Bass:Field(type="String", name="email")
         */
        this.email = null;

        /**
         * @Bass:Field(type="String", name="name")
         */
        this.name = null;

        /**
         * @Bass:Version
         * @Bass:Field(type="Number", name="version")
         */
        this.version = 0;

        /**
         * @Bass:CreatedAt
         * @Bass:Field(type="Date", name="created_at")
         */
        this.createdAt = null;

        /**
         * @Bass:UpdatedAt
         * @Bass:Field(type="Date", name="updated_at")
         */
        this.updatedAt = null;
    }

}
