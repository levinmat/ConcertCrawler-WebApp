 // Client-side JavaScript


// Switch between the two main views (Error/Initial view and Results view)
function errorView() {
	// The view for initial landing and error page
	$("#main").css("grid-column", "1 / span 3");
	$("#sidebar").addClass("hidden");
	$("#info").removeClass("hidden");
}
function resultsView() {
	// The view for showing results
	$("#main").css("grid-column", "1 / span 2");
	$("#sidebar").removeClass("hidden");
	$("#info").addClass("hidden");
}


// Main function that executes the search
function executeSearch() {

	$('#loading-gif').removeClass("hidden"); // Show the loading icon

	var query = $("#searchField").val().toLowerCase().split(' ').join('-');
	console.log(query);

	// Ajax request to get JSON response
	$.ajax({
		url: "/search/" + query,
		type: "GET",
		success: function(response) { // No server error
			console.log(response);
			renderResponse(response);
			$('#main').animate({ scrollTop: 0 }, 'fast');
			$('#loading-gif').addClass("hidden");

		},
		error: function(response) { // Server error, shouldn't happen
		console.log(response);
		renderResponse({success:false,'error':'unknown-error'});
		$('#loading-gif').addClass("hidden");
	}	
});

	// Save query in the URL for bookmarking purposes
	if (window.location.search != "?q=" + query) {
		window.history.pushState({}, document.title, "/index.html?q=" + query);
	}
}


function showHelp() {
	$("#info").html(`Search for an artist that has live shows <i>(albums with a full date in the title)</i> available on Spotify, e.g. <a href="index.html?q=grateful-dead">Grateful Dead</a> or <a href="index.html?q=the-allman-brothers-band">The Allman Brothers Band</a>, to see their live shows in chronological order.`);
}


// Templates (rendered using Mustache.js)
const sidebarTemplate = `<a href='#{{year}}' onclick=scrollToYear({{year}})>{{year}} ({{count}})</a><br>`;
const yearTemplate = `<span class='year' id='{{year}}'><strong>{{year}}</strong> &mdash; {{count}} album(s)</span>`;
const albumTemplate = `
<a target='_blank' href={{url}}>
<div class='album'>

<div class='albumImage'>
<img src={{img_url}} alt="{{name}} image>"</img>
</div>

<div class='albumName'>
{{name}}
</div>

</div>
</a>`;



// Processes JSON from the Python script to populate the results and sidebar divs
function renderResponse(res) {
	const main = $("#main"); // Main results area
	const menu = $("#menu"); // Sidebar ('Jump to Year' menu)
	const search = $("#searchField") // Search bar

	// Error handling
	if (res === null || res.success === null || res.success === false) {
		// Unknown error or auth-error --- Should never happen
		var msg = 'An error occured, please try again or with a different artist.'
		
		// Recognized error --- No artist for query or no live albums for artist
		if(res.success === false) {
			if (res.error === 'no-artist-found') {
				msg = 'No artists were found with your query, please try a different search query.';
			}
			else if (res.error === 'no-live-albums') {
				msg = 'No live albums were detected for this artist, please try a different artist.';
			}
			else if (res.error === 'empty-query') {
				msg = 'No query was provided, please enter an artist with live albums on Spotify.';
			}
		}
		msg += ` <a href="#" onclick=showHelp()><i class="fas fa-question-circle"></i></a>`

		if ($("#search").parent().attr('id') === "header" ) {
			main.html("<div id='info'>" + msg + "<div>");
			$("#search").removeClass("searchInHeader");
			$("#search").detach().prependTo($("#main"));
		}
		else {
			$("#info").html(msg);
		}

		errorView();
		return;
	}

	$("#search").addClass("searchInHeader");
	$("#search").detach().appendTo($("#header"));
	// No error
	main.html("<h1>" + res.artist_name + " &ndash; Live Albums on Spotify");
	document.title = "ConcertCrawler | " + res.artist_name;
	menu.html("<strong>Jump to Year</strong><br>");

	const yearsWithAlbums = res.albums_by_year;

	// For each year that has live albums
	for (var i in yearsWithAlbums) {
		// New div for the year with the header and add an entry in the sidebar
		main.append("<div class='yearContainer'>");
		main.append(Mustache.render(yearTemplate, yearsWithAlbums[i]));
		menu.append(Mustache.render(sidebarTemplate, yearsWithAlbums[i]));

		// Add entry for each album in this year
		const albums = yearsWithAlbums[i].albums;
		for (var j in albums) {
			main.append(Mustache.render(albumTemplate, albums[j]));
		}

		main.append("</div>");
	}

	menu.append("</div>");
	resultsView();
	
}


// Helper function to scroll the main div to a given year
function scrollToYear(year) {
	var curr = $("#main").scrollTop(); // current scroll position
	var position = $("#" + year).position().top; // offset to desired position
	$("#main").animate({scrollTop: position + curr - 45}); // animated scroll to year
}


// Parse the URL parameter for bookmarking and forward/back buttons
function loadFromURL() {
	// Check if reloading a saved query
	var url = window.location.href;
	const paramLocation = window.location.href.indexOf('?q=');
	if (paramLocation != -1) {
		q = url.split('#')[0].substring(paramLocation + 3).split('-').join(' ');
		if (q != $("#searchField").val() ) {
			$("#searchField").val(q);
			executeSearch();
		}
		else {
			try {
				// For forward/back between different years - doesn't affect new page loads
				year = url.slice(-5).substring(1);
				if (! isNaN(year)) {
					scrollToYear(year);
				}
			}
			catch (er) { console.log('avoided crashing on new page load w/ year hash.'); }    		
		}

	}
	else {
		$('#loading-gif').addClass("hidden"); // Hide loading icon
	}
}


$(document).ready(function() {

	loadFromURL(); // Reload if this is a results page (index.html?q=...)

	// Search on pushing enter
	$("#searchField").keyup(function(event) {
		if (event.keyCode === 13) {
			$("#searchIcon").click();
		}
	});

	$("#searchField").focus(function() {
		// If on mobile select all text automatically
		if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
			window.scrollTo(0, 0);
			$(this).select();
		}
	});


	// Make sure server is currently connected to Spotify API (token expires)
	$.ajax({
		url: "/auth",
		type: "GET",
		complete: function(response) {
			console.log('Auth Status: ' + response.status);
		}
	});


	$("#footer").removeClass("hidden");


	// Listen for back/forward button to go to prev/last query
	$(window).on('popstate', function (e) {
    	// special case, goes back to initial screen
    	if (e.currentTarget.location.href.indexOf("?q=") === -1) {
    		window.location.href = "index.html"
    	} // ignore hash changes due to "Jump to Year"
    	else  {
    		console.log("reload w/ url query!")
    		loadFromURL();
    	}
    });

});

