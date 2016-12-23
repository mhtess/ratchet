var express = require('express'),
 		app = express(),
 		fs = require('fs'),
 		vm = require('vm'),
 		moment = require('moment');

vm.runInThisContext(fs.readFileSync(__dirname + '/config.js'))
var use_db = configs.use_db
var time_to_play = configs.play_time
var exit_survey_url = configs.exit_survey_url

var nChains = config.nChains; // number of chains
var nGenPerChain = config.nGenPerChain; // number of gens in a chain
var bigN = nChains * nGenPerChain;

var getTimestamp = function(){
	var date = moment().format().slice(0, 10)
	var time = moment().format().slice(11, 19)
	return date + ' ' + time
}

try {
	var
		 https = require('https'),
		 port = configs.https_port,
		 privateKey = fs.readFileSync(configs.private_key),
		 certificate = fs.readFileSync(configs.certificate),
		 credentials = {key: privateKey, cert: certificate},
		 server = https.createServer(credentials, app),
		 io = require('socket.io').listen(server);
} catch(err){
	console.log("HTTPS failed to launch -- falling back to HTTP")
	var
		 http = require('http'),
		 port = configs.http_port,
		 server = http.createServer(app),
		 io = require('socket.io').listen(server)
}

// DATABASE INFORMATION

// chains collection contains documents that look like:
// {gen: 4, chain: 2, genInProgress: false, chainInProgress: true, workerid: workerid, condition: condition, startTime: time}

// messages collection
// might want to make different collections for different conditions (e.g., language vs. data passing)
// {gen: 4, chain: 2, message: "as the bugs get bigger, the trees get smaller", workerid: workerid, condition: "language"}
// {gen: 4, chain: 2, message: [{stimulus: 0.34, response: 0.76}, ... ], workerid: workerid, condition: "data_incidental"}

// trials collection (for discrete time experiments)
// consult nathaniel's mysql code for ideas for continuous time expts
// {gen: 4, chain: 2, trial: 14, stimulus: 0.34, response: 0.76, feedback: false, workerid: workerid, condition: condition}


if (use_db) {
	var mongodb = require('mongodb');
	//We need to work with "MongoClient" interface in order to connect to a mongodb server.
	var MongoClient = mongodb.MongoClient;
	// var url = 'mongodb://superAdmin:admin123@localhost:27017/admin';
	var url = 'mongodb://superAdmin:admin123@localhost:27017/mydb?';
	// var url = 'mongodb://[username:password@]host1[:port1][/[database][?options]]'
	var db, chain_collection, results_collection;
	// Initialize connection once
	MongoClient.connect(url, function(err, database) {
	  // if(err) throw err;
		if (err) {
	    console.log('Unable to connect to the mongoDB server. Error:', err);
	  } else {
			console.log('Connection established to', url);
		  db = database;
			chain_collection = db.collection('chains');
			messages_collection = db.collection('messages');
			trials_collection = db.collection('trials');
		  // Start the application after the database connection is ready
		  app.listen(3000);
		  console.log("Listening on port 3000");
		}
	});

	// var database = require(__dirname + '/js/database')
	// var connection = mysql.createConnection({
	// 	host		: configs.mysql_host,
	// 	user		: configs.mysql_user,
	// 	password	: configs.mysql_password,
	// 	database	: configs.mysql_password
	// })
}

app.use(express.static(__dirname));

app.get(/^(.+)$/, function(req, res){
     console.log('static file request : ' + req.params);
     console.log("ACCESS: " + req.params[0])
     res.sendFile(__dirname + req.params[0])
 });

//namespace for assigning experiment parameters
var expnsp = io.of('/experiment-nsp')
// this is run when the client is detected
// CONDITION ASSIGNMENT
//  IN THIS SITUATION, THIS IS CHAIN & GEN ASSIGNMENT
expnsp.on('connection', function(socket){

  // TO DO
	// proper handling of start time
	// figure out waiting situation,
	// icing: estimate wait time for next participant and display

  // WARNING:
  // currently, i'm making MongoDB queries (without callbacks, which are required)
  // and pretending like I can store the results in a new variable
  // i don't believe this is actually possible.
  // instead, we may have to do all this logic and new assignment within callbacks

  // http://stackoverflow.com/questions/35192122/how-do-i-store-a-mongodb-query-result-in-a-variable
  // https://github.com/mongodb/node-mongodb-native#find-all-documents

	// for max chain val
	var newestChain = chain_collection.find().sort({chain:-1}).limit(1)
	var nextChain = newestChain.chain + 1;
	// have we run out of chains?
	var outOfChains = newestChain == nChains;

	// or
	// var newestChain = chain_collection.aggregate(
	//    [{$group: { _id: "$chain", maxChain: { $max: "$chain" } }}]
	//  );

	// of the chains that are NOT finished (chainInProgress: true) and
	// don't currently have a gen running (genInProgress: false)
	// find the maximum generation
	var nextGens = chain_collection.aggregate(
   [
		 {
			 $match:
				 {'genInProgress': false},
				 {'chainInProgress': true}
		 },
     {$group: { _id: "$chain", maxGen: { $max: "$gen" } }}
   ]
 );

 	var participantMustWait = (!nextGens && outOfChains);

	// the generation that's been running the longest
	// only run under certain conditions
	var longestRunningGen = chain_collection.aggregate(
		 [
			 {$match: {'chainInProgress': true}, {'genInProgress': true} },
			 {$group: { _id: "$chain", time: { $max: "$startTime" } }}
		 ]
	 );

	 // CHAIN ASSINGNMENT LOGIC
	// if nextGens exists, we assign the incoming participant to the chain closest to completion
	// could imagine other schemes (e.g., the chain furthest from completion);

	// if nextGens DOESNT exist (if there are no chains in progress that have a ready slot):
	// then make a new chain (if we can)
	// otherwise, assign the participant to the chain that's been running the longest
	var lastGenInChain = nextGens ? _.max(nextGens, "gen") :
										outOfChains ? longestRunningGen :
										-1;


	var chain = nextGens ? lastGenInChain.chain :
						outOfChains ? longestRunningGen.chain :
						nextChain;

	var condition = nextGens ? lastGenInChain.condition :
						outOfChains ? longestRunningGen.chain :
						assignCondition();

	// is this the last generation in the chain
	var chainInProgress = lastGenInChain.gen + 1 < nGenPerChain;

	chain_collection.insert({
		gen: lastGenInChain.gen + 1, // increment gen counter
		chain: chain, // same chain as lastGenInChain
		genInProgress: true, // so that the next participant doesn't get assigned to this same position
		chainInProgress: chainInProgress // is this the end of the chain
	})

  // IF FIRST GEN: GENERATE RANDOM DATA FROM TRUE FUNCTION
	var dataToPass = messages_collection.find({gen: lastGenInChain.gen, chain: chain}).message


	var assignCondition = function(){
		//code for determining the condition of the experiment
		// TO DO: counterbalance by chains
		var condition = _.sample(['language', 'data_incidental']) //
		// send the client "condition var"
	}

	socket.emit('dataPass', dataToPass);

})

var gamensp = io.of('/game-nsp')
gamensp.on('connection', function(socket){

	var hs = socket.handshake
	var query = require('url').parse(socket.handshake.headers.referer, true).query
	var condition = (query.condition) ? query.condition : 'a' //try to pull condition from url, if fail --> default to 'a'
	var user = (query.workerId) ? query.workerId : 'undefinedID'

	var inventory = {
		pocket: 'empty',
		apples: 0,
		fishes: 0
	}

	console.log("Connection from user: " + user + ".")

	if (use_db) {
		database.addPlayer(user, condition)

	}

	//function for updating database
	var updateDB = function(action){
		if(use_db){
			database.updatePlayer(user, condition, action, inventory.pocket, inventory.apples, inventory.fishes)
		}
	}

	collection.insert([user1, user2, user3], function (err, result) {
		 if (err) {
			 console.log(err);
		 } else {
			 console.log('Inserted %d documents into the "users" collection. The documents inserted with "_id" are:', result.length, result);
		 }
		 //Close connection
		 db.close();
	 })


	//counts down until time_to_play has run out
	var timer = function(seconds){
		setTimeout(function(){
			if (seconds >= 1){
				timer(seconds - 1)
			}else{
				var destination = '/exitsurvey.html'
				socket.emit('redirect', destination)
				console.log("redirecting " + user)
			}
		}, 1000)
	}

	timer(time_to_play)

	socket.on('action', function(action){
		if(action == 'get apple'){
			inventory.apples += 1
		}else if(action == 'shoot apple'){
			inventory.apples -= 1
		}else if(action == 'get rock'){
			inventory.pocket = 'rock'
		}else if(action == 'shoot rock'){
			inventory.pocket = 'empty'
		}

		if(use_db){
			updateDB(action)
		}
	});

	var exportCSV = function(){
		//function for exporting CSVs goes here
	}

	socket.on('discconect', function(){
		exportCSV()
	})
})

server.listen(port, function(){
	console.log("Game server listening port " + port + ".")
	if(use_db){
		console.log("Logging results in mongo database.")
	}
})
