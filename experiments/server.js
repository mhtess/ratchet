var express = require('express'),
 		app = express(),
 		fs = require('fs'),
 		vm = require('vm'),
 		moment = require('moment');

vm.runInThisContext(fs.readFileSync(__dirname + '/config.js'))
// var use_db = configs.use_db
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

var mongodb = require('mongodb')
var MongoClient = mongodb.MongoClient
var url = 'mongodb://superAdmin:admin123@localhost:27017/mydb?'
var db
MongoClient.connect(url, function(err, database){
	if(err){
		console.log("Error connecting to mongoDB server: ", err)
	}else{
		console.log("Connection established to", url)
		db = database
		main(db)
	}
})	

var main = function(db){
	app.listen(3000)
	console.log("listening on port 3000")
	var chain_collection = db.collection('chains')
	var data_collection = db.collection('data')
	var language_collection = db.collection('language')
	var trials_collection = db.collection('trials')
	
	app.use(express.static(__dirname));

	app.get(/^(.+)$/, function(req, res){
	     console.log('static file request : ' + req.params);
	     console.log("ACCESS: " + req.params[0])
	     res.sendFile(__dirname + req.params[0])
	 });


	var fnnsp = io.of('/function-nsp')
	fnnsp.on('connection', function(socket){
		//things to do on connection
		//	* assign condition
		//	* assign chain and generation

		// for max chain val
		//newestChain:
		chain_collection.find().toArray(function(err, docs){
			assert.equal(null, err)
			var newestChain = docs
			newestChain.sort({chain:-1}).limit(1)
			var nextChain = newestChain.chain + 1
			var outOfChains = (newestChain == nChains) //will this all work???
			chain_collection.aggregate(
				[
					{
						$match:
							{'genInProgress': false},
							{'chainInProgress': true}
					},
					{
						$group:
							{_id: "$chain", maxGen: { $max: "$gen" }}
					}
				],
				function(err, results){
					assert.equal(null, err)
					var nextGens = results
					var participantMustWait = (!nextGens && outOfChains)
					//longestRunningGen:
					chain_collection.aggregate(
						[
							{$match: {'chainInProgress': true}, {'genInProgress': true}},
							{$group: {_id: "$chain", time: { $max: "$startTime" } }}
						],
						function(err, res){
							assert.equal(null, err)
							var longestRunningGen = res
							//the rest of the chain assignment logic should be able to go in here...

							// CHAIN ASSINGNMENT LOGIC
							// if nextGens exists, we assign the incoming participant to the chain closest to completion
							// could imagine other schemes (e.g., the chain furthest from completion);

							// if nextGens DOESNT exist (if there are no chains in progress that have a ready slot):
							// then make a new chain (if we can)
							// otherwise, assign the participant to the chain that's been running the longest
							// in this case, they would have to wait, so we emit the previous gen's data/language when ready

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

							// chains collection contains documents that look like:
							// {gen: 4, chain: 2, genInProgress: false, chainInProgress: true, workerid: workerid, condition: condition, startTime: time}
							//we need to get the workerID from the client, then store it in this chain and assign a condition
							socket.emit('workerID request')
							socket.on('workerID', function(workerID){
								var assignCondition = function(chain){
									//idea:
									//query the chain_collection for this chain, check condition in chain
									//if new chain, then assign condition somehow (balance it?)
								}
								var condition = assignCondition()
								var new_chain = {
									gen: lastGenInChain.gen + 1,
									chain: chain,
									genInProgress: true,
									chainInProgress: chainInProgress,
									workerid: workerID,
									condition: condition,
									startTime: getTimestamp()
								}
							})
							chain_collection.insert({
								gen: lastGenInChain.gen + 1, // increment gen counter
								chain: chain, // same chain as lastGenInChain
								genInProgress: true, // so that the next participant doesn't get assigned to this same position
								chainInProgress: chainInProgress, // is this the end of the chain

							})

						  // IF FIRST GEN: GENERATE RANDOM DATA FROM TRUE FUNCTION
						  //depending on condition, we then send corresponding data to the new participant

							var condition = assignCondition()
							var dataToPass = messages_collection.find({gen: lastGenInChain.gen, chain: chain}).message

							socket.emit('dataPass', dataToPass);
						}
					)
				}
			)

		var assignCondition = function(){
			//code for determining the condition of the experiment
			// TO DO: counterbalance by chains
			var condition = _.sample(['language', 'data_incidental']) //
			if(condition == 'language'){
				//query the language result, send it along
			}else{
				//query
			}
			socket.emit('condition')
			// send the client "condition var"
		}

		socket.on('trial', function(trial_data){
			//handle trial data by putting in db
			//have the trial data packaged on client side
			trials_collection.insert(trial_data, function(err, result){
				if(err){
					console.log("Error:", err)
				}else{
					console.log("Inserted %d documents", result.length)
				}
			})
		})

		socket.on('language', function(language_data){
			//again, have language_data packaged on client side
			language_collection.insert(language_data, function(err, result){
				if(err){
					console.log("Error:", err)
				}else{
					console.log("Inserted %d documents", result.length)
				}
			})
		})

	})

	server.listen(port, function(){
		console.log("Server listening port " + port + ".")
		if(use_db){
			console.log("Logging results in mongo database.")
		}
	})
}

