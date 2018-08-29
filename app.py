# Flask web server to run the web app
# Uses server-side caching and contains endpoints that call functions in live_albums.py

from flask import Flask, Response
from werkzeug.contrib.cache import SimpleCache
from flask_compress import Compress


from live_albums import *


app = Flask(__name__, static_url_path="/static")

# Cache 200 queries, remove entry after 24 hours
queryCache = SimpleCache(threshold=200, default_timeout=86400)    # Query --> Artist ID
responseCache = SimpleCache(threshold=200, default_timeout=86400) # Artist ID --> Response JSON


# Boolean for whether app successfully connected with Spotify API
authorized = False



# Initial page load
@app.route('/')
@app.route('/index.html')
def landing():
    return app.send_static_file('index.html')
 


# Main endpoint - Searches for artist and returns JSON results for their live albums
#   - query: Artist query separated by dashes
@app.route('/search/<query>')
def search(query):
	# First check connection to Spotify API - should always be authorized here
	global authorized
	if not authorized:
		authorized = create_spotify_client() # Try creating a new one
		if not authorized: # Still didn't work, respond with auth-error
			js = json_dump({'success':False, 'error':'auth-error'})
			res = Response(js, status=200, mimetype='application/json')
			return res
	
	# Get artistID for query from cache or live_albums.py if not in cache
	artistID = queryCache.get(query)
	if artistID is None:
		artistID = get_artist_id(query) # Function in live_albums.py
		queryCache.set(query, artistID)

	# Get JSON response for artistID from cache or live_albums.py if not in cache
	jsonResponse = responseCache.get(artistID)
	if jsonResponse is None:
		jsonResponse = get_live_albums_for_artist(artistID) # Function in live_albums.py
		responseCache.set(artistID, jsonResponse)
	
	# Return with JSON format and 200 status
	return Response(jsonResponse, status=200, mimetype='application/json')



# Special case for when the query is empty
@app.route('/search/')
def emptyQuery():
	js = json_dump({'success':False, 'error':'empty-query'})
	return Response(js, status=200, mimetype='application/json')



# Set up connection with Spotify API
# Called with AJAX on page load since auth token expires
@app.route('/auth')
def auth():
	global authorized
	authorized = create_spotify_client() # Function in live_albums.py
	if authorized: return Response({}, status=200, mimetype='application/json')
	else: return Response({}, status=500, mimetype='application/json')




# Run the server
if __name__ == "__main__":
	Compress().init_app(app)
	app.run()
