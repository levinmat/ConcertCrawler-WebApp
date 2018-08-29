# Functions to interact with Spotify to get the live albums for a queried artist in order
# and then return them in JSON format to be rendered by the client-side JavaScript.

import spotipy # Spotify Python wrapper
from spotipy.oauth2 import SpotifyClientCredentials
import re # Regular Expressions (used to extract dates from album names)
from os import environ # Environment variables
from heapq import nsmallest, heappush # Priority Queue (used to order by date)
from json import dumps as json_dump
import logging
logging.basicConfig(level='ERROR')



sp = None # Spotify Client object, initially None


# Authorizes with Spotify API
# Returns success or failure boolean and sets the global sp variable
def create_spotify_client():
    try:        
        client_id = environ['SPOTIFY_CLIENT_ID']
        client_secret = environ['SPOTIFY_CLIENT_SECRET']
        client_credentials_manager = SpotifyClientCredentials(client_id, client_secret)
        global sp
        sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)
        return True
    except:
        logging.debug('ERROR: Error creating spotify client.')
        return False
    


# Finds artist's live albums -> Formats as JSON -> Returns JSON
def get_live_albums_for_artist(artist_id):
    if artist_id == -1:
        logging.debug('ERROR: No artists found for query')
        return json_dump({'success':False, 'error':'no-artist-found'})

    artist_live_albums = find_live_albums_for_artist(artist_id)

    if len(artist_live_albums) == 0:
        logging.debug('ERROR: No live albums found for artist')
        return json_dump({'success':False, 'error':'no-live-albums'})

    jsonData = generate_json_from_albums(artist_id, artist_live_albums)

    return jsonData


 
 
 
# Gets the artist ID for a query or returns -1 if no artists match query
def get_artist_id(artist_query):
    query = ' '.join(artist_query.split('-'))

    search_results = sp.search(q=query, type='artist')
    
    if len(search_results['artists']['items']) == 0:
        return -1 # No artist found for query

    artist_id = search_results['artists']['items'][0]['id']
    return artist_id    





# Isolates the live albums for a given artist_id using regular expressions on the album name
# Live albums are albums that have a full date in their title so they can be sorted by date
def find_live_albums_for_artist(artist_id):
    # Get all the albums for the artist, 50 at a time (API limit)
    albums, offset = [], 0
    while True:
        next_batch = sp.artist_albums(artist_id, album_type='album', limit=50, offset=offset)['items']
        albums += next_batch
        offset += 50
        if len(next_batch) != 50: # If this is the last batch, break loop
            break

    live_albums = [] # Albums that are a *single* live show, not live compilations
    # Albums are detected to be live iff they have an exact date in the title

    months = ['january','february','march','april','may','june','july',
              'august','september','october','november','december']  # Month strings
    short_months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

    for album in albums:
        name = album['name'].encode('utf-8').lower()

        # Match: ', YYYY' or '# YYYY' --- Find a full year, will later look for other details
        year_re = re.search('(,|[0-9]|-)\s*([0-9]{4})', name)
        
        # Match: 'MM/DD/YYYY' or 'MM.DD.YYYY' (or 1 M or 1 D or 2 Y)
        date_re = re.findall('([^0-9]|^)([0-9]+)(?P<sep>[/\.\-])([0-9]+)(?P=sep)([0-9]+)([^0-9]|$)', name)
        # date_re uses a named group, sep, to ensure the same seperator (/ or - or .) between month, day, year
        #         without this '8/03-8/04/04' matches with '8/03-8' which is not the right date
        

        # Format with the month as a string then day and year as numbers
        if year_re:
            month_day_re = re.search(r'(%s) ([0-9]{1,2})([^0-9]|$)' % '|'.join(months), name)
            # short_month_day_re = re.search(r'({})'.format('|'.join(short_months)) + r' ([0-9]{1,2})([^0-9]|$)', name)
            # alt_month_day_re = re.search( r'([0-9]{1,2})([^0-9]|$) ' + r'({})'.format('|'.join(months)), name)
            # alt_short_month_day_re = re.search( r'([0-9]{1,2})([^0-9]|$) ' + r'({})'.format('|'.join(short_months)), name)

            day_re = re.findall('[^0-9]([0-9]{1,2})[^0-9]', name) # Finds all 1 or 2 digit numbers (day)
            if(len(day_re) > 1): # Include albums that are multiple nights?
                # continue # No, skip
                pass # Yes, keep going using the first night listed for sorting
            if(len(day_re) == 0): # If no day was found, skip this album
                continue

            if month_day_re == None:
                continue # No Month Day pattern found, skip
            # Add '0' to day if needed
            day = month_day_re.group(2)
            if len(day) == 1:
                day = '0' + day
            # Add '0' to month if needed
            month = months.index(month_day_re.group(1))
            if month < 9:
                month = '0' + str(month + 1)
            else:
                month = str(month + 1)
            # Generate the key for sorting - YYYYMMDD
            key = year_re.group(2) + month + day
            # print(name)
            # print(key)
            heappush(live_albums, (key, album))

        # Simpler MM/DD/YYYY format (1 M or 1 D or 2 Y digits all valid too i.e. 8/4/72 --> 08/04/1972)
        elif len(date_re) > 0:
            date = date_re[0]
            y = date[4]
            if(len(y) == 2):
                if(int(y) < 25): # Educated guess on the century
                    y = '20' + y
                else:
                    y = '19' + y
            m = date[1]
            if(len(m) == 1):
                m = '0' + m
            d = date[3]
            if(len(d) == 1):
                d = '0' + d
            logging.debug('{}/{}/{}'.format(m,d,y))
            key = y + m + d # Key for sorting - YYYYMMDD
            heappush(live_albums, (key, album))


    # Return the heap to be processed in generate_json_from_albums
    return live_albums




# Formats identified live albums for the artist as JSON to be rendered by JS on the client-side
def generate_json_from_albums(artist_id, live_albums):
    data = {}
    data['artist_id'] = artist_id
    data['artist_name'] = sp.artist(artist_id)['name']
    albums_by_year = [] # [year : count, [albums]]

    logging.debug(len(live_albums))
    prev_year = None
    curr_year = {}
    for (key, album) in nsmallest(len(live_albums), live_albums):
        year = key[0:4]
        if year != prev_year:  # New year
            if year == '9999': break # For unsorted albums, ignore
            if prev_year is not None: albums_by_year.append(curr_year)

            prev_year = year
            curr_year = {'year':year, 'count':0, 'albums':[]}

        # Extract album name, link to album on Spotify, and album art
        link = album['external_urls']['spotify']
        name = album['name']
        img = album['images'][0]['url'] # Just use the first image and scale it down

        curr_year['albums'].append({'url':link, 'name':name, 'img_url':img})
        curr_year['count'] += 1

    if len(live_albums) == 0: # No live albums were found
        data['success'] = False
    else:
        albums_by_year.append(curr_year)
        data['albums_by_year'] = albums_by_year
        data['success'] = True

    json_data = json_dump(data)
    logging.info(json_data)
    return json_data

