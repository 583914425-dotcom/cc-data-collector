/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3545980753")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "number3612436111",
    "max": null,
    "min": null,
    "name": "milestoneCount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text4101391790",
    "max": 0,
    "min": 0,
    "name": "url",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2548032275",
    "max": 0,
    "min": 0,
    "name": "imageUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3482007254",
    "max": 0,
    "min": 0,
    "name": "claimedBy",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1420050708",
    "max": 0,
    "min": 0,
    "name": "claimedByEmail",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text241447166",
    "max": 0,
    "min": 0,
    "name": "claimedByName",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2585205160",
    "max": 0,
    "min": 0,
    "name": "claimedAt",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3545980753")

  // remove field
  collection.fields.removeById("number3612436111")

  // remove field
  collection.fields.removeById("text4101391790")

  // remove field
  collection.fields.removeById("text2548032275")

  // remove field
  collection.fields.removeById("text3482007254")

  // remove field
  collection.fields.removeById("text1420050708")

  // remove field
  collection.fields.removeById("text241447166")

  // remove field
  collection.fields.removeById("text2585205160")

  return app.save(collection)
})
