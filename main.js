const mapWidth = 1000;
const mapHeight = 800;

const sliderWidth = 900;
const sliderHeight = 100;

let selectedRegion = "World";
let currentYear = 1960;
let g;
let path;
let projection;
let handleWidth;
let sliderHandle;
let yearDisplay;
let sliderSVG;
let mapSVG;

document.addEventListener('DOMContentLoaded', function() {
    initialiseSVG(); 
    drawLegend();
    activateKeyframe(1); 
});

let yearScale = d3.scaleLinear()
    .domain([1960, 2021])  
    .range([(sliderWidth - 400) / 2, (sliderWidth + 400) / 2 - handleWidth]); 

function initialiseSVG(){
projection = d3.geoMercator()
    .scale(165)
    .translate([mapWidth / 2 - 20, mapHeight / 1.5]);

path = d3.geoPath(projection);

mapSVG = d3.select('.map-container').append('svg')
    .attr('width', mapWidth)
    .attr('height', mapHeight);

console.log("initialiseSVG called");

mapSVG.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', mapWidth)
        .attr('height', mapHeight)
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', 4)
        .attr('opacity', 0) 
        .transition() 
        .duration(500)
        .attr('opacity', 1);

g = mapSVG
    .append('g');

const defs = mapSVG.append('defs');
const noDataPattern = defs.append('pattern')
    .attr('id', 'noDataPattern')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 4)
    .attr('height', 4);

noDataPattern.append('path')
    .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
    .attr('style', 'stroke:black; stroke-width:0.6');

sliderSVG = d3.select('.slider-container').append('svg')
    .attr('width', sliderWidth)
    .attr('height', sliderHeight);

handleWidth = 10;

sliderSVG.append("rect")
    .attr("x", (sliderWidth - 400) / 2)
    .attr("y", (sliderHeight - 20) / 2)
    .attr("width", 400)
    .attr("height", 20)
    .attr("fill", "#ddd");

sliderHandle = sliderSVG.append("rect")
    .attr("x", (sliderWidth - 400) / 2)
    .attr("y", (sliderHeight - 20) / 2)
    .attr("width", handleWidth)
    .attr("height", 20)
    .attr("fill", "#666")
    .call(d3.drag().on("drag", function(event) {
        let x = Math.max((sliderWidth - 400) / 2, Math.min(event.x, (sliderWidth + 400) / 2 - handleWidth));
        d3.select(this).attr("x", x);
    
        const yearScale = d3.scaleLinear()
            .domain([(sliderWidth - 400) / 2, (sliderWidth + 400) / 2 - handleWidth])
            .range([1960, 2021]);
        currentYear = Math.round(yearScale(x));
    
        yearDisplay.text(currentYear);
        updateTitleYear(currentYear);
        updateMap();
    })); 



// Year labels on the slider
sliderSVG.append("text").attr("x", (sliderWidth - 400) / 2).attr("y", (sliderHeight - 20) / 2 - 5).attr("text-anchor", "start").text("1960");
sliderSVG.append("text").attr("x", (sliderWidth + 400) / 2).attr("y", (sliderHeight - 20) / 2 - 5).attr("text-anchor", "end").text("2021");

// Display for current year
yearDisplay = sliderSVG.append("text")
    .attr("x", sliderWidth / 2)
    .attr("y", (sliderHeight - 20) / 2 + 35)
    .attr("text-anchor", "middle")
    .text(currentYear);

updateTitleYear(currentYear);

}

document.addEventListener('DOMContentLoaded', function() {
    const element = document.getElementById('region-dropdown');
    if (element) {
        const customDropdown = new Choices(element, {
            searchEnabled: false,
            itemSelectText: '',
        });
    }
});

const employmentLookup = {};

d3.select("#region-dropdown").on("change", function() {
    selectedRegion = d3.select(this).property("value");
    updateProjectionForRegion(selectedRegion);
});

async function loadData(){
    d3.csv("female-employment-to-population-ratio.csv").then(data => {
        data.forEach(d => {
            const countryName = d["Entity"];
            if (!employmentLookup[countryName]) {
                employmentLookup[countryName] = {};
            }
            employmentLookup[countryName][d.Year] = +d["Employment to population ratio, 15+, female (%) (national estimate)"];
        });
        renderMap(selectedRegion);
    }).catch(error => {
        console.error("Error loading CSV data", error);
    });
}

function renderMap(region) {
    Promise.all([
        d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
        d3.json('continents.json')
    ]).then(([worldAtlasData, continentsArray]) => {
        const countries = topojson.feature(worldAtlasData, worldAtlasData.objects.countries);
        const continentLookup = {};
        continentsArray.forEach(entry => {
            continentLookup[entry.country] = entry.continent;
        });

        const filteredCountries = countries.features.filter(country => {
            if (region === 'World') return true;
            const countryName = country.properties.name;
            return continentLookup[countryName] === region;
        });

        const paths = g.selectAll('path')
            .data(filteredCountries, d => d.id);

        // Enter selection for new countries
        paths.enter()
            .append('path')
            .attr('d', path)
            .attr('fill', 'white')
            .attr('stroke', 'black')
            .attr('opacity', 0)
            .transition()
            .duration(1000)
            .attr('opacity', 1);

        // Update selection for existing countries
        paths
            .transition()
            .duration(1000)
            .attr('d', path)
            .attr('opacity', 1);

        // Exit selection for removing countries that are no longer present
        paths.exit()
            .transition()
            .duration(1000)
            .attr('opacity', 0)
            .remove();

    // Click event listener for each country path
g.selectAll('path').on('click', function(event, d) {
    event.stopPropagation(); // Prevent the click event from propagating to other elements

    let countryData = employmentLookup[d.properties.name];
    let countryName = d.properties.name;
    let dataForGraph = Object.keys(countryData).map(year => {
        return { year: +year, employmentRate: countryData[year] };
    });
    dataForGraph.sort((a, b) => a.year - b.year);

    let graphTooltip = d3.select('#graph-tooltip');
    let isVisible = !graphTooltip.classed('hidden');
    if (isVisible) {
        graphTooltip.classed('hidden', true);
    } else {
        // Calculate the position for the tooltip
        let [x, y] = path.centroid(d);
        let [translateX, translateY] = projection([x, y]);
        
        // Adjust the position based on the size of the tooltip if necessary
        d3.select('#graph-tooltip')
                    .transition()
                    .duration(500)
                    .style('left', (x + mapSVG.node().getBoundingClientRect().left) + 'px')
                    .style('top', (y + mapSVG.node().getBoundingClientRect().top - 28) + 'px') // Adjust this value to position the tooltip above the country
                    .select('#tooltip-country');
        
        createLineGraph('#graph-tooltip', dataForGraph,countryName);

        d3.select('#graph-tooltip').classed( 'hidden', false);
    }
});

// Hide the tooltip when clicking anywhere on the SVG outside the countries
    mapSVG.on('click', function() {
        d3.select('#graph-tooltip').classed('hidden', true);
    });


        updateMap();
    }).catch(error => {
        console.error("Error loading map data", error);
    });
}

function createLineGraph(containerSelector, data, countryName) {
    // Remove any existing SVG first to prevent duplicates
    d3.select(containerSelector).selectAll('svg').remove();

    // Define the size of the graph
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Create the SVG container for the graph
    const svg = d3.select(containerSelector)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create the scales
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.employmentRate)])
        .range([height, 0]);

    // Draw the line
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.employmentRate));
    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);

    // Add the X Axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .style('font-size', '20px')
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));

    // Add the Y Axis
    svg.append('g')
        .style('font-size', '20px')
        .call(d3.axisLeft(y));

    svg.append('text')
       .attr('x', width / 2)
       .attr('y', 25 - margin.top)
       .attr('text-anchor', 'middle')
       .style('font-size', '30px') 
       .text(countryName); 
}

function updateProjectionForRegion(region) {
    switch (region) {
        case "Africa":
            projection.center([20, -15]).scale(440);
            break;
        case "Asia":
            projection.center([85, 10]).scale(450);
            break;
        case "Europe":
            projection.center([10, 57]).scale(380);
            break;
        case "North America":
            projection.center([-90, 50]).scale(270);
            break;
        case "South America":
            projection.center([-65, -40]).scale(480);
            break;
        case "Oceania":
            projection.center([140, -35]).scale(700);
            break;
        default:
            projection.center([0, 15]).scale(165);
    }

    renderMap(region);
}

function updateMap() {
    g.selectAll('path').each(function(d) {
        const countryEntityName = d.properties.name;
        console.log(countryEntityName);
        const employmentValue = employmentLookup[countryEntityName] ? employmentLookup[countryEntityName][currentYear] : null;

        // Set fill based on employment value
        if (employmentValue != null) {
            d3.select(this).attr('fill', colorScale(employmentValue));
        } else {
            d3.select(this).attr('fill', 'url(#noDataPattern)');
        }

        // Tooltip event handlers
        d3.select(this)
            .on('mouseover', function(event, d) {
                console.log('Mouseover on country:', d.properties.name);
                const centroid = path.centroid(d);
                const [x, y] = centroid;

                // Position tooltip at the centroid of the country path
                d3.select('#tooltip')
                    .style('left', (x + mapSVG.node().getBoundingClientRect().left) + 'px')
                    .style('top', (y + mapSVG.node().getBoundingClientRect().top - 28) + 'px') // Adjust this value to position the tooltip above the country
                    .select('#tooltip-country')
                    .text(countryEntityName);

                d3.select('#tooltip')
                    .select('#tooltip-rate')
                    .text(employmentValue);

                d3.select('#tooltip').classed('hidden', false);
            })
            .on('mousemove', function(event, d) {
                // Update the tooltip's position to follow the mouse
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px') 
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select('#tooltip').classed('hidden', true);
            });
    });
}

function updateTitleYear(year) {
    d3.select('.title').text(`Female employment-to-population ratio, ${year}`);
  }  

let container = d3.select(".map-container");
let gradientWidth = 800;
let xOffset = 200; 
let yOffset = 20;
let textOffset = 50;  
let gradientColors = ["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8", "#807dba", "#6a51a3", "#54278f", "rgb(74,20,134)", "#3f007d"];
let colorScale;
let segmentWidth = gradientWidth / gradientColors.length;

function drawLegend() {
    container = d3.select(".color-gradient-bar");
    let legend = container.append("svg")
        .attr("id", "legend")
        .attr("width", "1200")
        .attr("height", "100");

    colorScale = d3.scaleQuantize()
        .domain([0, 100])  
        .range(gradientColors);

    gradientColors.forEach((color, i) => {
        legend.append("rect")
            .attr("x", xOffset + (i * segmentWidth))
            .attr("y", yOffset)
            .attr("width", segmentWidth)
            .attr("height", "50")
            .style("fill", color)
            .attr("stroke", "black")
            .attr("stroke-width", "1");
    });

    const intervals = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    intervals.concat([0, 100]).forEach((position) => {
        legend.append("text")
            .attr("x", (position / 100) * gradientWidth + xOffset + textOffset - (segmentWidth / 2))
            .attr("y", 90)
            .attr("text-anchor", "middle")
            .attr("font-size", "20px")
            .text(position + "%");
    });

    legend.append("rect")
        .attr("x", 10)  
        .attr("y", yOffset)
        .attr("width", segmentWidth)
        .attr("height", "50")
        .style("fill", "url(#noDataPattern)") 
        .attr("stroke", "black")
        .attr("stroke-width", "1");

    legend.append("text")
        .attr("x", 45) 
        .attr("y", 95)
        .attr("font-size", "22px")
        .attr("text-anchor", "middle")
        .text("No data");
}

let keyframeIndex = 0;

let keyframes = [
    {
        activeVerse: 1,
        activeLines: [1, 2, 3, 4, 5],
        handleActivation: () => {
            // Actions specific to verse 1
            console.log("Activating Verse 1");
            zoomOutFullView(); 
            clearVerseVisuals();
            d3.select('#animation-indicator').classed('hidden', true);
        }
    },    
    {
        activeVerse: 2,
        activeLines: [1, 2, 3],
        handleActivation: () => {
            console.log("Activating Verse 2");
            // Code to highlight China and zoom in
            highlightChina();
            zoomInOnChina();
            // Other operations for verse 2
            updateMap();
            updateTitleYear(2002);
            showBirthYearExplanation();
            stopAllAnimations();
        }
    },
     {
        activeVerse: 3,
        activeLines: [1],
        handleActivation: () => {
            // Actions specific to verse 1
            console.log("Activating Verse 3 line 1");
            zoomOutFullView(); // Function to zoom out to the full map view
            clearVerseVisuals();
            animateSliderAndMap(1960, 2021, 20000);
        }
    },
    {
        activeVerse: 3,
        activeLines: [2],
        handleActivation: () => {
            // Actions specific to verse 1
            console.log("Activating Verse 3 line 2");
            // clearVerseVisuals();
            stopAllAnimations();
            d3.select('#animation-indicator').classed('hidden', true);
        }
    },
    {
        activeVerse: 3,
        activeLines: [3]
    },
    {
        activeVerse: 4,
        activeLines: [1,2,3,4]
    },
    {
        activeVerse: 5,
        activeLines: [1]
    },
    {
        activeVerse: 5,
        activeLines: [2]
    },
    {
        activeVerse: 5,
        activeLines: [3]
    },
    {
        activeVerse: 5,
        activeLines: [4]
    }
];

function activateKeyframe(verseIndex) {
    // Find the keyframe for the specified verse index
    let keyframe = keyframes.find(kf => kf.activeVerse === verseIndex);

    // Call the handler function if it exists
    if (keyframe && keyframe.handleActivation) {
        keyframe.handleActivation();
    } else {
        console.log("No activation handler for verse", verseIndex);
    }
}

function resetSvgUpdateFlags() {
    // Reset svgUpdateCalled flags for all keyframes except the first one
    keyframes.forEach((kf, index) => {
        if (index !== 0) { // Skip the first verse to avoid re-initialization
            kf.svgUpdateCalled = false;
        }
    });
}

document.getElementById('forward-button').addEventListener('click', forwardClicked);
document.getElementById('backward-button').addEventListener('click', backwardClicked);

function forwardClicked() {
    if (keyframeIndex < keyframes.length - 1) {
        resetSvgUpdateFlags(); 
        keyframeIndex++;
        console.log("Forward Clicked, Keyframe Index:", keyframeIndex); 
        drawKeyframe(keyframeIndex);
    }
}

function backwardClicked() {
    if (keyframeIndex > 0) {
        resetSvgUpdateFlags(); 
        keyframeIndex--;
        console.log("Backward Clicked, Keyframe Index:", keyframeIndex); 
        drawKeyframe(keyframeIndex);
    }
}

let lastScrollTime = 0;
const scrollDebounceTime = 200; 

document.getElementById('poem-container').addEventListener('wheel', function(e) {
    e.preventDefault(); // Prevent the default scroll behavior

    const currentTime = new Date().getTime();

    if (currentTime - lastScrollTime > scrollDebounceTime) {
        lastScrollTime = currentTime;

        if (e.deltaY > 0) {
            forwardClicked(); // Advance to the next part of the poem
        } else if (e.deltaY < 0) {
            backwardClicked(); // Go back to the previous part of the poem
        }
    }
});

function drawKeyframe(kfi) {
    console.log("Drawing keyframe:", kfi);
    let kf = keyframes[kfi];

    // Reset poem verses and lines
    resetActiveLines();

    kf.activeLines.forEach(line => {
        updateActiveLine(kf.activeVerse, line);
    });

    // Activate the specific actions for the current keyframe
    if (kf.handleActivation) {
        kf.handleActivation();
    }
}

function resetActiveLines(){
    d3.selectAll(".line").classed("active-line", false);
}

function updateActiveLine(vid,lid){
    let thisVerse = d3.select("#verse" + vid);
    thisVerse.select("#line" + lid).classed("active-line", true);
}

let zoom = d3.zoom()
    .scaleExtent([1, 8]) 
    .on('zoom', (event) => {
        g.attr('transform', event.transform); 
    });

function setActiveVerse(verseNumber) {
    clearVerseVisuals();

    if (verseNumber === 2) {
        currentYear = 2002;
        
        highlightChina();
        zoomInOnChina();
        showBirthYearExplanation();
        updateMap();
        updateTitleYear(currentYear);
    } else {
        // For verse 1 or any other verses where you want the full map view
        currentYear = 1960; // Or the default year for the full map view
        
        // Zoom out to the full map view
        mapSVG.transition().duration(1000)
            .call(zoom.transform, d3.zoomIdentity);

        updateMap();
        updateTitleYear(currentYear);
    }
}

function clearVerseVisuals() {
    mapSVG.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);
    g.selectAll('path').classed('highlighted', false);
    g.selectAll('.birth-balloon').remove();
}

function highlightChina() {
    g.selectAll('path')
        .classed('highlighted', d => d.properties.name === 'China');
}

function zoomInOnChina() {
    let chinaPath = g.selectAll('path').filter(d => d.properties.name === 'China');
    if (!chinaPath.empty()) {
        let centroid = path.centroid(chinaPath.datum());
        let scale = 2.5;
        let translate = [mapWidth / 2 - scale * centroid[0], mapHeight / 2 - scale * centroid[1]];
        mapSVG.transition().duration(1000)
            .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }
}

function zoomOutFullView() {
    // Reset the zoom level to show the full map
    mapSVG.transition().duration(1000).call(zoom.transform, d3.zoomIdentity);

    // Reset any highlighted countries or other visual styles
    g.selectAll('path').classed('highlighted', false);

}

function showBirthYearExplanation() {

    g.selectAll('.birth-balloon').remove();

    // Assume 'chinaPath' is the d3 selection of the path element for China
    let chinaPath = g.selectAll('path').filter(function(d) {
        return d.properties.name === 'China';
    });

    // Get the centroid of China's path
    let centroid = path.centroid(chinaPath.datum());

    // Create a group for the speech balloon
    let balloonGroup = g.append('g')
        .attr('class', 'birth-balloon')
        .attr('transform', `translate(${centroid[0]}, ${centroid[1] - 30})`); // Adjust this translation as needed

    // Append a rectangle to the group (as the balloon background)
    balloonGroup.append('rect')
        .attr('x', -50) // Adjust the x position as needed
        .attr('y', -35) // Adjust the y position as needed
        .attr('width', 150) // Set the width of the balloon background
        .attr('height', 40) // Set the height of the balloon background
        .attr('rx', 5) // Optional: set this to make the corners rounded
        .attr('ry', 5) // Optional: set this to make the corners rounded
        .style('fill', 'white')
        .style('stroke', 'black');

    // Append text to the group
    balloonGroup.append('text')
        .attr('x', -45) // Adjust the x position as needed
        .attr('y', -10) // Adjust the y position to align the text within the rectangle
        .text('I was born here in 2002')
        .style('fill', 'black')
        .style('font-size', '15px');
}

let animationInterval = null; 

function animateSliderAndMap(startYear, endYear, duration) {

     // Show animation indicator
    d3.select('#animation-indicator').classed('hidden', false);

    console.log("function animateSliderAndMap is called");

    // Calculate the range of years and the interval between updates
    const yearRange = endYear - startYear;
    const intervalDuration = duration / yearRange;
  
    // Set up an interval to update the map as the handle moves
    animationInterval = d3.interval(elapsed => {
      // Calculate the current year based on the elapsed time
      const currentYear = startYear + Math.round((elapsed / duration) * yearRange);
      if (currentYear <= endYear) {
        // Update the map for the current year
        updateYearAndMap(currentYear);
      } else {
        // Stop the interval when the end year is reached
        animationInterval.stop();
        d3.select('#animation-indicator').classed('hidden', true);
      }
    }, intervalDuration);
  
    // Ensure the transition and interval are stopped when the animation is complete
    // sliderTransition.on("end", () => interval.stop());
}

function updateYearAndMap(year) {
    currentYear = year;
    yearDisplay.text(currentYear);
    updateMap();
    updateTitleYear(currentYear);
}

function stopAllAnimations() {
    if (animationInterval) {
        animationInterval.stop(); // Stop the interval if it's running
    }
}


document.addEventListener('DOMContentLoaded', async function() {
    // Load the data and draw the initial keyframe
    await initialise();

    // Set up the click event listeners for all elements with 'global-word' class
    document.querySelectorAll('.global-word').forEach(element => {
        element.addEventListener('click', function() {
            console.log("global clicked!");
            // console.log("Number of global-word elements at DOMContentLoaded:", document.querySelectorAll('.global-word').length);
            const alreadyHighlighted = g.selectAll('path').classed('global-border-highlight');
            g.selectAll('path')
                .classed('global-border-highlight', !alreadyHighlighted); // Add or remove the class
        });
    });
});


async function initialise() {
    await loadData();
    drawKeyframe(keyframeIndex);
}

