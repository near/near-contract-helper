const Promise = require('bluebird');

function createDocument(schema, object, params) {
    return schema.createAsync(stripUndefinedValues(object), { overwrite: false, ...params })
        .then((document) => document.toJSON());
}

function deleteDocument(schema, object, params) {
    return schema.destroyAsync(object, { ReturnValues: 'ALL_OLD', ...params })
        .then((document) => document && document.toJSON());
}

function getDocument(schema, keys) {
    return schema.getAsync(keys)
        .then((document) => document && document.toJSON());
}

function listDocuments(schema, { hashKey }) {
    return Promise.promisifyAll(schema.query(hashKey))
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
    return schema.updateAsync(stripUndefinedValues(object), { ReturnValues: 'ALL_NEW', ...params })
        .then((document) => document.toJSON());
}

module.exports = {
    createDocument,
    deleteDocument,
    getDocument,
    listDocuments,
    updateDocument,
};
