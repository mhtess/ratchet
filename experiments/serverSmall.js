var express = require('express'),
 		app = express(),
 		fs = require('fs'),
 		vm = require('vm'),
 		moment = require('moment');

vm.runInThisContext(fs.readFileSync(__dirname + '/config.js'))
// var use_db = configs.use_db
var time_to_play = configs.play_time
var exit_survey_url = configs.exit_survey_url

// var nChains = config.nChains; // number of chains
// var nGenPerChain = config.nGenPerChain; // number of gens in a chain
// var bigN = nChains * nGenPerChain;

//hard code in the above
var nChains = 4
var nGenPerChain = 6
var bigN = nChains * nGenPerChain

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

var mongodb = require('mongodb')
var MongoClient = mongodb.MongoClient
var url = 'mongodb://superAdmin:admin123@localhost:27017/test?authSource=admin';
var db
MongoClient.connect(url, function(err, database){
	if(err){
		console.log("Error connecting to mongoDB server: ", err)
	}else{
		console.log("Connection established to", url)
		db = database
		server.listen(4343)
		console.log("listening on port 4343")
		var chain_collection = db.collection('chains')
		var data_collection = db.collection('data')
		var language_collection = db.collection('language')
		var training_collection = db.collection('training')
		
		app.use(express.static(__dirname));

		app.get(/^(.+)$/, function(req, res){
		     console.log('static file request : ' + req.params);
		     console.log("ACCESS: " + req.params[0])
		     res.sendFile(__dirname + req.params[0])
		 });

		var fnnsp = io.of('/function-nsp')
		//the plan...
		//we are running only two chains right now - one for language, one for data.
		//on connection, we assign to language or data_incidental chain
		//then, depending on the chain we send relevant information
		//	* NB if they're the first generation, we send nothing (this is docs.length == 0 || docs.length == 1 below)
		//we receive data, and store as normal (below as socket.on('data', function(trial_data){}))
		//we don't have to worry about anyone waiting because the HITs are posted 2 at a time --> always an opening

		fnnsp.on('connection', function(socket){
			console.log('connection')
			socket.emit('workerID request')
			var this_workerID;
			var started = false;
			var finished = false;
			socket.on('request data', function(workerID){
				this_workerID = workerID
				started = true
				console.log('workerID:', this_workerID)
				//we need to check if there's a chain with generation==0 and genInProgress==false
				//if such a chain exists, then we assign this worker to that chain
				//if not, then we check the number of chains that have been assigned so far
				//if it's less than nChains, we assign as necessary
				//if it's equal to nChains, then we assign to minGen's chain
				chain_collection.find().sort({'gen':1}).toArray(function(err, results){
					//check if there's no results
					//if there are results, check if the first doc's gen is 0
					if(err){
						console.log('err', err)
					}else{
						if(results.length > 0){
							var min_gen_doc = results[0]
							if(min_gen_doc.gen == 0){
								//assign to that chain
								var condition = min_gen_doc.condition
								var chain = min_gen_doc.chain
								var new_chain = {
									gen: 1,
									chain: chain,
									genInProgress: true,
									chainInProgress: true,
									workerID: this_workerID,
									condition: condition
								}
								chain_collection.insertOne(new_chain, function(err, res){
									if(err){
										console.log('err', err)
									}else{
										//delete min_gen_doc from the chains collection
										console.log('inserted into aborted chain...')
										chain_collection.deleteOne(min_gen_doc, function(err, res){
											if(err){
												console.log('err', err)
											}else{
												console.log('deleted aborted chain doc')
												socket.emit('assignment', {condition: condition, data: [], gen: 1, chain: chain})
											}
										})
									}
								})
							}else{
								//if we don't have the full number of chains yet, but there's no abandoned spots
								if(results.length < nChains){
									if(results.length < nChains/2){
										var condition = 'language'
										var new_chain = {
											gen: 1,
											chain: results.length + 1,
											genInProgress: true,
											chainInProgress: true,
											workerID: workerID,
											condition: condition
										}
										chain_collection.insertOne(new_chain, function(err, res){
											if(err){
												console.log('err', err)
											}else{
												console.log('emitting data for new')
												socket.emit('assignment', {condition: condition, data: [], gen: 1, chain: results.length + 1})
											}
										})
									}else{
										var condition = 'data_incidental'
										var new_chain = {
											gen: 1,
											chain: results.length + 1,
											genInProgress: true,
											chainInProgress: true,
											workerID: workerID,
											condition: condition
										}
										chain_collection.insertOne(new_chain, function(err, res){
											if(err){
												console.log('err', err)
											}else{
												console.log('emitting data for two')
												socket.emit('assignment', {condition: condition, data: [], gen: 1, chain: results.length + 1})
											}
										})
									}
								}else{
									var condition = min_gen_doc.condition
									var new_chain = {
										gen: min_gen_doc.gen + 1,
										chain: min_gen_doc.chain,
										genInProgress: true,
										chainInProgress: true,
										workerID: workerID,
										condition: condition
									}
									chain_collection.insertOne(new_chain, function(err, res){
										if(err){
											console.log('err', err)
										}else{
											console.log('inserted new chain into chains')
											if(condition == 'language'){
												//get the language data
												console.log('searching for language for chain', min_gen_doc.chain)
												console.log('gen', min_gen_doc.gen)
												language_collection.find({gen: min_gen_doc.gen, chain: min_gen_doc.chain}).toArray(function(err, results){
													if(err){
														console.log('err', err)
													}else{
														console.log('emitting data with language:', results[0].message)
														socket.emit('assignment', {condition: condition, data: results[0].message, gen: min_gen_doc.gen + 1, chain: min_gen_doc.chain})
														deleteMinGen(min_gen_doc)
													}
												})
											}else if(condition == 'data_incidental'){
												//get the incidental data
												data_collection.find({gen: min_gen_doc.gen, chain: min_gen_doc.chain}).toArray(function(err, results){
													if(err){
														console.log('err', err)
													}else{
														var data_to_send = results.map(function(this_doc){
															var x = this_doc.stimulus
															var y = this_doc.response
															return {x, y}
														})
														console.log('emitting %d data points to user', data_to_send.length)
														socket.emit('assignment', {condition: condition, data: data_to_send, gen: min_gen_doc.gen + 1, chain: min_gen_doc.chain})
														deleteMinGen(min_gen_doc)
													}
												})
											}
											var deleteMinGen = function(min_gen_doc){
												chain_collection.deleteOne(min_gen_doc, function(err, res){
													if(err){
														console.log('err', err)
													}else{
														console.log('deleted min_gen_doc (old chain document)')
													}
												})
											}
										}
									})
								}
							}
						}else{
							var new_chain = {
								gen: 1,
								chain: 1,
								genInProgress: true,
								chainInProgress: true,
								workerID: workerID,
								condition: 'language'
							}
							chain_collection.insertOne(new_chain, function(err, res){
								if(err){
									console.log('err', err)
								}else{
									console.log('emitting data for first user')
									socket.emit('assignment', {condition: 'language', data: [], gen: 1, chain: 1})
								}
							})
						}
					}
				})
			})			

			socket.on('training', function(training_data){
				console.log('received data')
				var new_training_doc = {
					gen: training_data.gen,
					chain: training_data.chain,
					stimulus: training_data.stimulus,
					response: training_data.response,
					workerID: training_data.workerID,
					condition: training_data.condition
				}
				training_collection.insertOne(new_training_doc, function(err, results){
					if(err){
						console.log('err', err)
					}else{
						console.log('stored training trial from worker:', training_data.workerID)
					}
				})
			})

			socket.on('data', function(trial_data){
				console.log('received data')
				var new_data_doc = {
					gen: trial_data.gen,
					chain: trial_data.chain,
					stimulus: trial_data.stimulus,
					response: trial_data.response,
					workerID: trial_data.workerID,
					condition: trial_data.condition
				}
				data_collection.insertOne(new_data_doc, function(err, results){
					if(err){
						console.log('err', err)
					}else{
						console.log('stored test trial from worker:', trial_data.workerID)
					}
				})
			})

			socket.on('language', function(language_data){
				var new_language_doc = {
					gen: language_data.gen,
					chain: language_data.chain,
					message: language_data.message,
					workerID: language_data.workerId
				}
				language_collection.insertOne(new_language_doc, function(err, results){
					if(err){
						console.log('err', err)
					}else{
						console.log('inserted language doc from worker:', language_data.workerID)
						console.log('message:', language_data.message)
					}
				})
			})

			//receive when a worker completes their experiment - we can set the genInProgress var for their chain to false
			socket.on('complete', function(workerID){
				finished = true;
				chain_collection.update({workerID: workerID}, {$set: {genInProgress: false}}, function(err, numChanged){
					if(err){
						console.log("error updating chain collection doc", err)
					}else{
						console.log("Changed %d doc(s)...", numChanged)
					}
				})
			})

			socket.on('disconnect', function(){
				//delete the relevant documents from this user if they started the experiment but did not finish it
				if(started && !finished){
					console.log('searching for:', this_workerID)
					chain_collection.find({workerID: this_workerID}).toArray(function(err, results){
						if(err){
							console.log('err', err)
						}else{
							console.log("results")
							console.log(results)
							worker_doc = results[0]
							console.log('worker_doc:')
							console.log(worker_doc)
							if(worker_doc.genInProgress){
								if(worker_doc.condition == 'language'){
									language_collection.deleteMany({workerID: this_workerID}, function(err, results){
										if(err){
											console.log('err', err)
										}
									})
								}
								data_collection.deleteMany({workerID: this_workerID}, function(err, results){
									if(err){
										console.log('err', err)
									}else{
										console.log('unexpected disconnection, deleted trial data from worker')
									}
								})
								training_collection.deleteMany({workerID: this_workerID}, function(err, results){
									if(err){
										console.log('err', err)
									}else{
										console.log('unexpected disconnection, deleted training data from worker')
									}
								})
								chain_collection.deleteOne(worker_doc, function(err, results){
									if(err){
										console.log('err')
									}else{
										console.log('unexpected disconnection, deleted chain info from worker')
									}
								})
								var temp_chain = {
									gen: worker_doc.gen - 1,
									chain: worker_doc.chain,
									genInProgress: false,
									chainInProgress: true,
									workerID: 'temp',
									condition: worker_doc.condition
								}
								chain_collection.insertOne(temp_chain, function(err, results){
									if(err){
										console.log('err', err)
									}else{
										console.log('inserted temp')
									}
								})
							}
						}
					})
				}
			})
		})
	}
})