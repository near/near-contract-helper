const Promise = require('bluebird');

function createDocument(schema, object, params) {
    return schema.createAsync(stripUndefinedValues(object), { ...params, overwrite: false })
        .then((document) => document.toJSON());
}

function deleteDocument(schema, object, params) {
    return schema.destroyAsync(object, { ...params, ReturnValues: 'ALL_OLD' })
        .then((document) => document.toJSON());
}

function getDocument(schema, keys) {
    return schema.getAsync(keys)
        .then((document) => document && document.toJSON());
}

function listDocuments(schema, { hashKey, index }) {
    let query = Promise.promisifyAll(schema.query(hashKey));
    if (index) {
        query = query.usingIndex(index);
    }

    return query
        .loadAll()
        .execAsync()
        .get('Items')
        .map((document) => document.toJSON());
}

function stripUndefinedValues(object) {
    return Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined),
    );
}

function updateDocument(schema, object, params) {
    return schema.updateAsync(stripUndefinedValues(object), { ...params, ReturnValues: 'ALL_NEW' })
        .then((document) => document.toJSON());
}

module.exports = {
    createDocument,
    deleteDocument,
    getDocument,
    listDocuments,
    updateDocument,
};
