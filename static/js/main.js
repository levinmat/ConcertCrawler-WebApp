 // Client-side JavaScript



// Always stores current URL, used for back/forward arrow compatibility 
var curURL = window.location.href;


// Main function that executes the search when enter pushed / search icon clicked
function executeSearch() {

	$('#loading-gif').removeClass("hidden"); // Show the loading icon

	var query = $("#searchField").val().toLowerCase().split(' ').join('-');
	console.log(query);

	// Save query in the URL for bookmarking purposes
	if (window.location.search != "?q=" + query) {
		window.history.pushState({}, document.title, "/index.html?q=" + query);
		curURL = window.location.href; // update with new URL
	}

	// Ajax request to get JSON response
	$.ajax({
		url: "/search/" + query,
		type: "GET",

		success: function(response) { // No server error
			console.log(response);
			renderResponse(response);
			// Scroll to year if hash is present
			if (curURL.slice(-5)[0] === '#') {
				scrollToYear(curURL.slice(-4));
			}
			// Else scroll to top
			else {
				$('#main').animate({ scrollTop: 0 }, 'fast');
			}
			$('#loading-gif').addClass("hidden");

		},

		error: function(response) { // Server error, shouldn't happen
		console.log(response);
		renderResponse({success:false,'error':'unknown-error'});
		$('#loading-gif').addClass("hidden");
	}	
});
}



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
		// Add help icon to info message
		msg += ` <a href="javascript:void(0);" onclick=showHelp()><i class="fas fa-question-circle"></i></a>`

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
	for (let year of yearsWithAlbums) {
		// New div for the year with the header and add an entry in the sidebar
		main.append("<div class='yearContainer'>");
		main.append(renderYearHeader(year));
		menu.append(renderSidebarEntry(year));

		// Add entry for each album in this year
		for (let album of year.albums) {
			main.append(renderAlbum(album));
		}

		main.append("</div>");
	}

	menu.append("</div>");
	resultsView();
	
}



// Render eaach component
function renderSidebarEntry(year) { // Menu bar links to jump to year
	return `<a href='#${year.year}' onclick=scrollToYear(${year.year})>${year.year} (${year.count})</a><br>`;
}
function renderYearHeader(year) { // Year section header
	return `<span class='year' id='${year.year}'><strong>${year.year}</strong> &mdash; ${year.count} album(s)</span>`;
}
function renderAlbum(album) { // Album 
	return `<a target='_blank' href=${album.url}>
<div class='album'>

<div class='albumImage'>
<img src=${album.img_url} alt="${album.name} image>"</img>
</div>

<div class='albumName'>
${album.name}
</div>

</div>
</a>`;
}


// Switch between the two main views
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



// When help icon is clicked, shows help text
function showHelp() {
	$("#info").html(`Search for an artist that has live shows <i>(albums with a full date in the title)</i> available on Spotify, e.g. <a href="index.html?q=grateful-dead">Grateful Dead</a> or <a href="index.html?q=the-allman-brothers-band">The Allman Brothers Band</a>, to see their live shows in chronological order. Looks best on Chrome or Firefox, and designed to work on mobile and tablets as well.`);
}


// Scrolls the main div to a given year
function scrollToYear(year) {
	var curr = $("#main").scrollTop(); // current scroll position
	var position = $("#" + year).position().top; // offset to desired position
	$("#main").animate({scrollTop: position + curr - 45}); // animated scroll to year
	curURL = window.location.href; // update new URL
}





function selectText() {
// On mobile, select all text in search field when clicked
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
		$("#searchField").focus();
		$("#searchField").select();
	}
}



$(document).ready(function() {

	// Check if reloading a query (as opposed to the default landing page)
	const paramLocation = curURL.indexOf('?q=');
	if (paramLocation != -1) {
		// Need to parse query and execute search
		q = curURL.split('#')[0].substring(paramLocation + 3).split('-').join(' ');
		// console.log(q);
		// console.log($("#searchField").val());
		$("#searchField").val(q);
		executeSearch();
	}
	else {
		// Don't need to change page, hide loading icon and show footer
		$('#loading-gif').addClass("hidden");
	}

	$("#footer").removeClass("hidden");

	// Search on pushing enter
	$("#searchField").keyup(function(event) {
		if (event.keyCode === 13) {
			$("#searchIcon").click();
		}
	});


	


	// Make sure server is currently connected to Spotify API (token expires and needs refresh sometimes)
	$.ajax({
		url: "/auth",
		type: "GET",
		complete: function(response) {
			console.log('Auth Status: ' + response.status);
		}
	});


	// Listen for back/forward button to go to prev/last query
	$(window).on('popstate', function (e) {
		var newURL = window.location.href;
		// Different artist - Just load the new URL
		if (curURL.split("#")[0] !== newURL.split("#")[0]) {
			window.location.reload();
		}
		//  Hash change - Jump to Year (hash) or to top if no year is in curURL
		else {
			var year = newURL.split("#")[1];
			if (year != undefined && year != "") { scrollToYear(year); }
			else { $('#main').animate({ scrollTop: 0 }, 'fast'); }
		}
	});

});

