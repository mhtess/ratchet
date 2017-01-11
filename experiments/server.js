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

var queueOfWorkers = []

// DATABASE INFORMATION

// chains collection contains documents that look like:
// {gen: 4, chain: 2, genInProgress: false, chainInProgress: true, workerid: workerid, condition: condition, startTime: time}

// messages collection
// might want to make different collections for different conditions (e.g., language vs. data passing)
// {gen: 4, chain: 2, message: "as the bugs get bigger, the trees get smaller", workerid: workerid, condition: "language"}
// {gen: 4, chain: 2, message: [{stimulus: 0.34, response: 0.76}, ... ], workerid: workerid, condition: "data_incidental"}

// data collection (for discrete time experiments)
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
	
	app.use(express.static(__dirname));

	app.get(/^(.+)$/, function(req, res){
	     console.log('static file request : ' + req.params);
	     console.log("ACCESS: " + req.params[0])
	     res.sendFile(__dirname + req.params[0])
	 });


	var fnnsp = io.of('/function-nsp')
	fnnsp.on('connection', function(socket){
		socket.on('data request', function(workerID){
			//things to do on connection
			//	* assign condition
			//	* assign chain and generation

			// for max chain val
			//newestChain:
			var assignCondition = function(socket, workerID){
				chain_collection.find().toArray(function(err, docs){
				assert.equal(null, err)
				var newestChain = docs.sort({chain:-1}).limit(1)
				var nextChain = newestChain.chain + 1
				var outOfChains = (newestChain == nChains) //this is true if the chain we just pulled is the nth chain
				chain_collection.aggregate(
					{"$match": {'genInProgress': false, 'chainInProgress': true} },
					{"$group": {_id: "$chain", maxGen: { "$max": "$gen"}} },
					function(err, results){
						assert.equal(null, err)
						var nextGens = results
						var participantMustWait = (!nextGens && outOfChains) //need to figure out what to do with this....
						//longestRunningGen:
						chain_collection.aggregate(
							{"$match": {'chainInProgress': true, 'genInProgress': true} },
							{"$group": {_id: "$chain", time: { "$max": "$startTime" } } },
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

								// is this the last generation in the chain
								var chainInProgress = lastGenInChain.gen + 1 < nGenPerChain;

								var condition = nextGens ? lastGenInChain.condition :
													outOfChains ? longestRunningGen.condition :
													'undefined';
								//if condition is not predetermined, we determine it by balancing
								if(!participantMustWait){
									if(condition == 'undefined'){
										chain_collection.aggregate(
											{"$match": {'condition': 'language'} },
											{"$group": {_id: "$chain", num_chains: { $sum: 1}} },
											function(err, results){
												if(err){
													console.log("Error matching for condition 'language':", err)
												}else{
													var language_count = results.length
													chain_collection.aggregate(
													[
														{
															"$match":
																{'condition': 'data_incidental'}
														},
														{
															"$group":
																{_id: "$chain", num_chains: { $sum: 1}}
														}
													], function(err, results){
														if(err){
															console.log("Error for matching condition 'data_incidental':", err)
														}else{
															var data_incidental_count = results.length
															if(language_count > data_incidental_count){
																condition = 'data_incidental'
															}else{
																condition = 'language'
															}
														}
													})
												}
											}
										)
									}

									// chains collection contains documents that look like:
									// {gen: 4, chain: 2, genInProgress: false, chainInProgress: true, workerid: workerid, condition: condition, startTime: time}

									//we need to get the workerID from the client, then store it in this chain and assign the client its condition/give it data
									//we wait for the worker to get to the "lobby" slide, at which point the client emits a data request
									var new_chain = {
										gen: (lastGenInChain == -1) ? 0 : lastGenInChain.gen + 1,
										chain: chain,
										genInProgress: true,
										chainInProgress: chainInProgress,
										workerid: workerID,
										condition: condition,
										startTime: getTimestamp()
									}
									chain_collection.insert(new_chain, function(err, results){
										if(err){
											console.log("Error inserting new worker:", err)
										}else{
											console.log("Inserted new worker", workerID)
											//send along data/language to new worker if they're not the 0th in their chain
											if (lastGenInChain != -1){
												if(condition == 'language'){
													//get the language, send it along
													language_collection.find({gen: lastGenInChain.gen, chain: chain}, function(err, cursor){
														if(err){
															console.log("error querying language from previous gen:", err)
														}else{
															cursor.toArray(function(err, results){
																//debugging pro strats: this should be length one or we've got duplicates in the db for messages from chain & gen
																assert.equal(1, results.length)
																socket.emit('assignment', {condition: condition, data: results[0].message})
															})
														}
													})
													socket.emit('assignment', {condition: condition, data: language_to_pass})
												}else if(condition == 'data_incidental'){
													data_collection.aggregate(
														{"$match": {chain: chain, generation: lastGenInChain.gen} },
														{"$group": },
														function(err, results){
															if(err){
																console.log("error collecting previous data:", err)
															}else{
																//turn results into a collection of x, ys
																// {gen: 4, chain: 2, trial: 14, stimulus: 0.34, response: 0.76, feedback: false, workerid: workerid, condition: condition}
																var data_to_pass = results.map(function(doc){
																	return {doc.stimulus, doc.response} //{x, y} == {stimulus (bug size), response (slider height)}
																})
																socket.emit('assignment', {condition: condition, data: data_to_pass})
															}
														}
													)
												}
											}else{
												//new in chain? generate random data from true function, happens on client side when data list is empty
												socket.emit('assignment', {condition: condition, data: []})
											}
										}
									})
								}else{
									//we have to wait for something to be complete....
									//idea: we keep a queue of people who are waiting, have clients emit "finished" events
									//when we receive a "finished" event, we assign the next person in the queue
									queueOfWorkers.append(socket)
								}
							}
						)
					}
				)
			}
			assignCondition(socket, workerID)		
		})
		//^^ double check that these all match...

		socket.on('data', function(trial_data){
			//handle trial data by putting in db
			//have the trial data packaged on client side
			data_collection.insert(trial_data, function(err, result){
				if(err){
					console.log("Error:", err)
				}else{
					console.log("Inserted %d documents into data collection", result.length)
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

		//this is kind of hacky -- essentialy queueOfWorkers is a queue of sockets, and we always take the first socket,
		//query the workerID, and then call assignCondition on the socket (stored as nextParticipant) with the received
		//workerID
		socket.on('complete', function(){
			//go to queueOfWorkers and take the first socket, assign it to a condition
			var nextParticipant = queueOfWorkers.shift() //this is a socket object
			nextParticipant.emit('workerID request')
			nextParticipant.on('workerID', function(workerID){
				assignCondition(nextParticipant, workerID)
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