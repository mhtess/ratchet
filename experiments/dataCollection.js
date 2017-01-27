var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var fs = require('fs');

var url = 'url';

var db, chain_collection, data_collection, language_collection;

MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    console.log('Connection established to', url);
    console.log("Current database", db.databaeName);

    //create a write stream with library fs for the data output
    var output_doc = fs.createWriteStream('data.csv')

    //grab the relevant collections
    chain_collection = db.collection('chains');
    language_collection = db.collection('language');
    data_collection = db.collection('data')

    //EXAMPLE
    //pull all data from language condition
    data_collection.find({condition: "language"}).toArray(function(err, results){
        if(err){
            console.log("err", err)
        }else{
            output_doc.write('"workerID","generation","stimulus","response","given language"\n') //header for CSV
            //Write a line to the data.csv file for each document tagged "language" in the data collection
            results.forEach(function(doc){
                var workerID = doc.workerID
                var gen = doc.gen
                var stim = doc.stimulus
                var response = doc.response
                language_collection.find({gen: gen-1}).toArray(function(err, results){
                    if(err){
                        console.log('err', err)
                    }else{
                        var language = (results.length != 0) ? results[0].message : 'none'
                        var new_line = '"' + workerID + '","' + gen + '","' + stim + '","' + response + '","' + language + '"\n'
                        output_doc.write(new_line)
                    }
                })
            })
            //close the connection once each document has been handled (forEach is blocking)
            db.close()
        }
    })
  }
});
