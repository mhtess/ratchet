//useful docs:
// https://www.tutorialspoint.com/mongodb/
// http://blog.modulus.io/mongodb-tutorial
// http://mongodb.github.io/node-mongodb-native/2.2/quick-start/
// https://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html
// https://medium.com/@raj_adroit/mongodb-enable-authentication-enable-access-control-e8a75a26d332#.jxvypxm94

// first run
// mongod --port 27017 --dbpath /data/db --config /usr/local/etc/mongod.conf

// not sure why this runs in the background, but i see it running in Activity Monitor

// the mongo.conf file is a yaml file that looks like:
// NB: need to make sure you have permissions for the paths in this file

// systemLog:
//   destination: file
//   path: /data/db/mongo.log
//   logAppend: true
// storage:
//   dbPath: /data/db
// net:
//   bindIp: 127.0.0.1
// security:
//   authorization: enabled

// MongoDB doesn't have any authentication by default so I set it up manually
// following
// https://medium.com/@raj_adroit/mongodb-enable-authentication-enable-access-control-e8a75a26d332#.1qs79yvya

//lets require/import the mongodb native drivers.
var mongodb = require('mongodb');

//We need to work with "MongoClient" interface in order to connect to a mongodb server.
var MongoClient = mongodb.MongoClient;

// Connection URL. This is where your mongodb server is running.
// to connect from command line Mongo:
// mongo --port 27017 -u "superAdmin" -p "admin123" --authenticationDatabase "admin"

// BASIC MONGO COMMANDS:
// db (shows current database)
// show dbs (shows all databases)
// use dbName (switches current db to dbName)
// show collections (shows collections within db)
// show collectionName (shows documents in collectionName)

// docs: https://www.tutorialspoint.com/mongodb/mongodb_drop_collection.htm

// var url = 'mongodb://localhost:27017/mydb';
var url = 'mongodb://superAdmin:admin123@localhost:27017/admin';

var db, chain_collection, results_collection;

// Use connect method to connect to the Server
MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    //HURRAY!! We are connected. :)
    console.log('Connection established to', url);
    console.log("Current database", db.databaseName);

    chain_collection = db.collection('chain_collection');
    // console.log(chain_collection.find().toArray())



    messages_collection = db.collection('messages');
    // trials_collection = db.collection('trials');

    // TO INSERT A DOCUMENT
    // messages_collection.insert(
    //   {gen: 0,	chain: 1, message: "hello there", chainInProgress: true}, function (err, result) {
    //   if (err) {
    //     console.log(err);
    //   } else {
    //     console.log('Inserted %d documents into the "chain" collection. The documents inserted with "_id" are:', result.length, result);
    // }})

    // TO LIST ALL DOCUMENTS IN A COLLECTION
    // messages_collection.find().toArray(function (err, result) {
    //   if (err) {
    //     console.log(err);
    //   } else if (result.length) {
    //     console.log('Found:', result);
    //   } else {
    //     console.log('No document(s) found with defined "find" criteria!');
    //   }
    // })
    var tmp;
    tmp = chain_collection.find().toArray()
    console.log(tmp)

    // var docsFound;
    // messages_collection.find().toArray(function (err, result) {
    //   if (err) {
    //     console.log(err);
    //   } else if (result.length) {
    //     docsFound = result;
    //     console.log(docsFound);
    //   } else {
    //     console.log('No document(s) found with defined "find" criteria!');
    //   }
    // });
    //
    // // this will print undefined because info doesn't get passed outside the callback
    // console.log(docsFound);
    //



    // do some work here with the database.

    //Create some users
    // var user1 = {name: 'modulus admin', age: 42, roles: ['admin', 'moderator', 'user']};
    // var user2 = {name: 'modulus user', age: 22, roles: ['user']};
    // var user3 = {name: 'modulus super admin', age: 92, roles: ['super-admin', 'admin', 'moderator', 'user']};

    // // CREATING NEW DOCUMENTS IN A COLLECTION
    // collection.insert([user1, user2, user3], function(err,result) {
    //   if (err) {
    //     console.log(err);
    //   } else {
    //     console.log('Inserted %d documents into the "users" collection. The documents inserted with "_id" are:', result.length, result);
    //   }
    //   //Close connection
    //   db.close();
    // });

    // // UPDATING DOCUMENT IN COLLECTION
    // collection.update({name: 'modulus user'}, {$set: {enabled: false}},
    // function (err, numUpdated) {
    //   if (err) {
    //     console.log(err);
    //   } else if (numUpdated) {
    //     console.log('Updated Successfully %d document(s).', numUpdated);
    //   } else {
    //     console.log('No document found with defined "find" criteria!');
    //   }
    //   //Close connection
    //   db.close();
    // });

    // // FINDING RESULTS
    // collection.find({name: 'modulus user'}).toArray(function (err, result) {
    // if (err) {
    //   console.log(err);
    // } else if (result.length) {
    //   console.log('Found:', result);
    // } else {
    //   console.log('No document(s) found with defined "find" criteria!');
    // }


    // collection.find()
    // // NOTE: toArray chained on find is shorthand for the following:

    //We have a cursor now with our find criteria
    // var cursor = collection.find({name: 'modulus user'});

    //We need to sort by age descending
    // cursor.sort({age: -1});

    //Limit to max 10 records
    // cursor.limit(10);

    //Skip specified records. 0 for skipping 0 records.
    // cursor.skip(0);

    //Lets iterate on the result
    // cursor.each(function (err, doc) {
    //   if (err) {
    //     console.log(err);
    //   } else {
    //     console.log('Fetched:', doc);
    //   }
    // });

    //Close connection
    db.close();
  // });

  }
});
