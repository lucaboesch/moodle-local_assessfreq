// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Javascript for heatmap calendar generation and display.
 *
 * @copyright  2020 Matt Porritt <mattp@catalyst-au.net>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(['core/str', 'core/notification', 'core/ajax'], function (Str, Notification, Ajax) {

    /**
     * Module level variables.
     */
    var Calendar = {};
    var eventArray = [];
    const stringArr = [
        {key: 'sun', component: 'calendar'},
        {key: 'mon', component: 'calendar'},
        {key: 'tue', component: 'calendar'},
        {key: 'wed', component: 'calendar'},
        {key: 'thu', component: 'calendar'},
        {key: 'fri', component: 'calendar'},
        {key: 'sat', component: 'calendar'},
        {key: 'jan', component: 'local_assessfreq'},
        {key: 'feb', component: 'local_assessfreq'},
        {key: 'mar', component: 'local_assessfreq'},
        {key: 'apr', component: 'local_assessfreq'},
        {key: 'may', component: 'local_assessfreq'},
        {key: 'jun', component: 'local_assessfreq'},
        {key: 'jul', component: 'local_assessfreq'},
        {key: 'aug', component: 'local_assessfreq'},
        {key: 'sep', component: 'local_assessfreq'},
        {key: 'oct', component: 'local_assessfreq'},
        {key: 'nov', component: 'local_assessfreq'},
        {key: 'dec', component: 'local_assessfreq'},
    ];
    var stringResult;
    var heatRangeMax;
    var heatRangeMin;
    var colorArray;
    var processModules;
    var heatRangeScale = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0};

    /**
     * Pick a contrasting text color based on the background color.
     *
     * @param  {String} hexcolor A hexcolor value.
     * @return {String} The contrasting color (black or white).
     */
    const getContrast = function (hexcolor) {

        if (typeof (hexcolor) === "undefined") {
            return '#000000';
        }

        // If a leading # is provided, remove it.
        if (hexcolor.slice(0, 1) === '#') {
            hexcolor = hexcolor.slice(1);
        }

        // Convert to RGB value.
        var r = parseInt(hexcolor.substr(0,2),16);
        var g = parseInt(hexcolor.substr(2,2),16);
        var b = parseInt(hexcolor.substr(4,2),16);

        // Get YIQ ratio.
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

        // Check contrast.
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    };

    /**
     * Check how many days in a month code.
     * from https://dzone.com/articles/determining-number-days-month.
     *
     * @method daysInMonth
     * @param {Number} month The month to get the number of days for.
     * @param {Number} year The year to get the number of days for.
     */
    const daysInMonth = function (month, year) {
        return 32 - new Date(year, month, 32).getDate();
    };

    /**
     * Get the heat colors to use in the heat map via Ajax.
     *
     * @method getHeatColors
     */
    const getHeatColors = function () {
        return new Promise((resolve, reject) => {
            Ajax.call([{
                methodname: 'local_assessfreq_get_heat_colors',
                args: {},
            }], true, false)[0].done(function (response) {
                colorArray = JSON.parse(response);
                resolve(colorArray);
            }).fail(function () {
                reject(new Error('Failed to get heat colors'));
            });
        });
    };

    /**
     * Get the event names that we are processing.
     *
     * @method getProcessEvents
     */
    const getProcessModules = function () {
        return new Promise((resolve, reject) => {
            Ajax.call([{
                methodname: 'local_assessfreq_get_process_modules',
                args: {},
            }], true, false)[0].done(function (response) {
                processModules = JSON.parse(response);
                resolve(processModules);
            }).fail(function () {
                reject(new Error('Failed to get process events'));
            });
        });
    };

    /**
     * Calculate the min and max values to use in the heatmap.
     *
     * @method daysInMonth
     * @param {Object} eventArray All the event count for the heatmap.
     * @param {Object} dateObj Date details.
     */
    const calcHeatRange = function (eventArray, dateObj) {
        return new Promise((resolve) => {

            // Resolve early if there are no events.
            if (typeof (eventArray) === "undefined") {
                heatRangeMax = 0;
                heatRangeMin = 0;

                resolve(eventArray);
            }
            // If scheduled tasks have not run yet we may not have any data.
            let eventArrayLength = Object.keys(eventArray).length;
            if ((eventArrayLength > 0) && (eventArray[dateObj.year] !== "undefined")) {
                let eventcount = new Array;
                let year = eventArray[dateObj.year];

                // Iterate through all the event counts.
                // This code looks nasty but there is only 366 days in a year.
                for (let i = 0; i < 12; i++) {
                    if (typeof year[i] !== "undefined") {
                        let month = year[i];
                        for (let j = 0; j < 32; j++) {
                            if (typeof month[j] !== "undefined") {
                                eventcount.push(month[j].number);
                            }
                        }
                    }
                }

                // Get min and max values to calculate heat spread.
                heatRangeMax = Math.max(...eventcount);
                heatRangeMin = Math.min(...eventcount);
            } else {
                heatRangeMax = 0;
                heatRangeMin = 0;
            }

            resolve(eventArray);
        });
    };

    /**
     * Translate assessment frequency to a heat value.
     *
     * @method getHeat
     * @param {Number} eventCount The count to get the heat value.
     * @return {Number} heat The heat value.
     */
    const getHeat = function (eventCount) {
        let scaleMin = 1;

        if (eventCount == heatRangeMin) {
            return scaleMin;
        }

        const scaleRange = 5;  // 0 - 5  steps.
        const localRange = heatRangeMax - heatRangeMin;
        const localPercent = (eventCount - heatRangeMin) / localRange;
        let heat = Math.round((localPercent * scaleRange) + 1);

        // Clamp values.
        if (heat < 1) {
            heat = 1;
        }

        if (heat > 6) {
            heat = 6;
        }

        return heat;
    };

    /**
     * Get the events to display in the calendar via ajax call.
     *
     * @method getEvents
     *
     * @param {Object} args The arguments to pass to the ajax call.
     * @param {Number} args.year The year to get the events for.
     * @param {String} args.metric The metric to get the events for.
     * @param {Array} args.modules The modules to get the events for.
     *
     * @return {Promise}
     */
    const getEvents = function ({year, metric, modules}) {
        return new Promise((resolve, reject) => {
            let args = {
                year: year,
                metric: metric,
                modules: modules
            };
            let jsonArgs = JSON.stringify(args);

            // Get the events to use in the mapping.
            Ajax.call([{
                methodname: 'local_assessfreq_get_frequency',
                args: {
                    jsondata: jsonArgs
                },
            }])[0].done((response) => {
                eventArray = JSON.parse(response);
                resolve(eventArray);
            }).fail(() => {
                reject(new Error('Failed to get events'));
            });
        });
    };

    /**
     * Get the events for a particular month and year.
     *
     * @param {Number} year The year to get the number of days for.
     * @param {Number} month The month to get the number of days for.
     * @return {Array} monthevents The events for the supplied month.
     */
    const getMonthEvents = function (year, month) {
        let monthevents;

        if ((typeof eventArray[year] !== "undefined") && (typeof eventArray[year][month] !== "undefined")) {
            monthevents = eventArray[year][month];
        }

        return monthevents;
    };

    /**
     * Create the table structure for the calendar months.
     *
     * @param {Object} args The arguments to pass to the ajax call.
     * @param {Number} args.year The year to get the events for.
     * @param {Number} args.startMonth The month to start the calendar
     * @param {Number} args.endMonth The month to end the calendar
     *
     * @return {Promise}
     */
    const createTables = function ({year, startMonth, endMonth}) {
        return new Promise((resolve, reject) => {
            let calendarContainer = document.createElement('div');
            let month = startMonth;

            // Itterate through and build are tables.
            for (let i = startMonth; i <= endMonth; i++) {
                // Setup some elements.
                let container = document.createElement('div');
                container.classList.add('local-assessfreq-month');
                let table = document.createElement('table');
                table.classList.add('table-striped');
                let thead = document.createElement('thead');
                let tbody = document.createElement('tbody');
                tbody.id = 'calendar-body-' + i;
                let monthRow = document.createElement('tr');
                let dayrow = document.createElement('tr');
                let monthHeader = document.createElement('th');
                monthHeader.colSpan = 7;
                monthHeader.innerHTML = stringResult[(7 + month)];

                for (let j = 0; j < 7; j++) {
                    let dayHeader = document.createElement('th');
                    dayHeader.innerHTML = stringResult[j];
                    dayrow.appendChild(dayHeader);
                }

                // Construct the table.
                monthRow.appendChild(monthHeader);

                thead.appendChild(monthRow);
                thead.appendChild(dayrow);

                table.appendChild(thead);
                table.appendChild(tbody);

                container.appendChild(table);

                // Add to parent.
                calendarContainer.appendChild(container);

                // Increment variables.
                month++;
            }

            if ((typeof year === 'undefined') || (typeof startMonth === 'undefined') || (typeof endMonth === 'undefined')) {
                reject(Error('Failed to create calendar tables.'));
            } else {
                const resultObj = {
                    calendarContainer : calendarContainer,
                    year : year,
                    startMonth : startMonth
                };
                resolve(resultObj);
            }
        });
    };

    /**
     * Generate the tooltip HTML.
     *
     * @param {Object} dayArray The details of the events for that day/
     * @return {String} tipHTML The HTML for the tooltip.
     */
    const getTooltip = function (dayArray) {
        let tipHTML = '';

        for (let [key, value] of Object.entries(dayArray)) {
            tipHTML += '<strong>' + processModules[key] + ':</strong> ' + value + '<br/>';
        }

        return tipHTML;
    };

    /**
     * Generate calendar markup for the month.
     *
     * @param {Object} table The base table to populate.
     * @param {Number} year The year to generate calendar for.
     * @param {Number} month The monthe to generate calendar for.
     */
    const populateCalendarDays = function (table, year, month) {
        let firstDay = (new Date(year, month)).getDay();  // Get the starting day of the month.
        let monthEvents = getMonthEvents(year, (month + 1));  // We add one due to month diferences between PHP and JS.
        let date = 1;  // Creating all cells.

        for (let i = 0; i < 6; i++) {
            let row = document.createElement("tr"); // Creates a table row.

            // Creating individual cells, filing them up with data.
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay) {
                    var cell = document.createElement("td");
                    var cellText = document.createTextNode("");
                    cell.dataset.event = 'false';
                } else if (date > daysInMonth(month, year)) { // Break if we have generated all the days for this month.
                    break;
                } else {
                    cell = document.createElement("td");
                    cellText = document.createTextNode(date);
                    if ((typeof monthEvents !== "undefined") && (monthEvents.hasOwnProperty(date))) {
                        let heat = getHeat(monthEvents[date]['number']);

                        if (heatRangeScale[heat] == 0 || heatRangeScale[heat] > monthEvents[date]['number']) {
                            heatRangeScale[heat] = monthEvents[date]['number'];
                        }

                        cell.style.backgroundColor = colorArray[heat];
                        cell.style.color = getContrast(colorArray[heat]);

                        // Add tooltip to cell.
                        cell.dataset.toggle = 'tooltip';
                        cell.dataset.html = 'true';
                        cell.dataset.event = 'true';
                        cell.dataset.date = year + '-' + (month + 1) + '-' + date;
                        cell.title = getTooltip(monthEvents[date]);
                        cell.style.cursor = "pointer";
                    }
                    date++;
                }

                cell.appendChild(cellText);
                row.appendChild(cell);
            }
            table.appendChild(row); // Appending each row into calendar body.
        }
    };

    /**
     * Controls the population of the calendar in to the base tables.
     *
     * @param {Object} args The arguments to pass to the ajax call.
     * @param {Object} args.calendarContainer The container to populate the calendar into.
     * @param {Number} args.year The year to get the events for.
     * @param {Number} args.startMonth The month to start the calendar
     *
     * @return {Promise}
     */
    const populateCalendar = function ({calendarContainer, year, startMonth}) {
        return new Promise((resolve, reject) => {
            // Get the table boodies.
            let tables = calendarContainer.getElementsByTagName("tbody");
            let month = startMonth;

            // For each table body populate with calendar.
            for (var i = 0; i < tables.length; i++) {
                let table = tables[i];
                populateCalendarDays(table, year, month);
                month++;
            }

            if (typeof calendarContainer === 'undefined') {
                reject(Error('Failed to populate calendar tables.'));
            } else {
                resolve(calendarContainer);
            }
        });
    };

    /**
     * Create the heatmap scale for the calendar.
     *
     * @method createHeatScale
     */
    Calendar.createHeatScale = function () {
        return new Promise((resolve) => {
            let table = document.createElement('table');
            let tbody = document.createElement('tbody');
            let trow = document.createElement('tr');

            for (var i = 1; i < 7; i++) {
                if (heatRangeScale[i] !== 0) {
                    let cell = document.createElement('td');
                    let cellText = document.createTextNode(heatRangeScale[i] + '+');

                    cell.appendChild(cellText);
                    cell.style.backgroundColor = colorArray[i];
                    cell.style.color = getContrast(colorArray[i]);

                    trow.appendChild(cell);
                }
            }

            tbody.appendChild(trow);
            table.appendChild(tbody);

            // Reset heat range scale.
            heatRangeScale = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0};

            resolve(table);
        });
    };

    /**
     * Initialise method for report calendar heatmap creation.
     *
     * @param {Number} year The year to generate the heatmap for.
     * @param {Number} startMonth The month to start with for the heatmap calendar.
     * @param {Number} endMonth The month to end with for the heatmap calendar.
     * @param {String} metric The type of metric to display, 'students' or 'aseess'.
     * @param {Array} modules The modules to display in the heatamp.
     * @return {Promise}
     */
    Calendar.generate = function (year, startMonth, endMonth, metric, modules) {
        return new Promise((resolve, reject) => {
            const dateObj = {
                year : year,
                startMonth : startMonth,
                endMonth : endMonth
            };

            const eventObj = {
                year : year,
                metric : metric,
                modules : modules
            };

            Str.get_strings(stringArr).catch(() => { // Get required strings.
                Notification.exception(new Error('Failed to load strings'));
                return;
            }).then(stringReturn => { // Save string to global to be used later.
                stringResult = stringReturn;
                return eventObj;
            })
            .then(getEvents)
            .then((eventArray) => {
                calcHeatRange(eventArray, dateObj);
            })
            .then(getHeatColors)
            .then(getProcessModules)
            .then(() => {
                return dateObj;
            })
            .then(createTables) // Create tables for calendar.
            .then(populateCalendar)
            .then((calendarHTML) => { // Return the result of the generate function.
                if (typeof calendarHTML !== 'undefined') {
                    resolve(calendarHTML);
                } else {
                    reject(Error('Could not generate calendar'));
                }
            });
        });

    };

    return Calendar;
});
