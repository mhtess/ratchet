# ratchet

## Function Learning Tasks

### How to run
#### Setup
Clone the repo, and run `npm install` in the directory to install the required packages for Node.js

First, make sure you have an instance of mongodb running on your server `mongod --port 27017 --dbpath /data/db --config /usr/local/etc/mongod.conf`. 

Your database should have four collections, which are used to manage different chains/conditions, as well as to store relevant data collected during the experiment.
These collections are as follows:
* chains
* language
* training
* data

Then, edit the `config.js` file to set the url used to connect to mongodb, the port(s) for your server, and the location of ssl certificates (MTurk requires https for HITs).

Make sure that the collections used by mongo are empty, and start the server with `node server.js`.

#### Data collection
There is an example data collection/parsing script at `ratchet/experiments/dataCollection.js` - this script processes all of the data from the language condition into a csv for easy viewing in a spreadsheet.
Other data can be processed by making slight modifications to this script.

## World Exploration Tasks
