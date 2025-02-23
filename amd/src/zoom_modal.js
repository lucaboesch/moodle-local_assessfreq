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
 * Javascript for report card display and processing.
 *
 * @copyright  2020 Matt Porritt <mattp@catalyst-au.net>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(
    ['core/str', 'core/modal', 'core/fragment', 'core/ajax', 'core/templates', 'local_assessfreq/modal_large',
    'core/notification'],
    function (Str, Modal, Fragment, Ajax, Templates, ModalLarge, Notification) {

        /**
         * Module level variables.
         */
        var ZoomModal = {};
        var contextid;
        var modalObj;
        const spinner = '<p class="text-center">'
            + '<i class="fa fa-circle-o-notch fa-spin fa-3x fa-fw"></i>'
            + '</p>';

        /**
         * Provides zoom functionality for card graphs.
         *
         * @param {object} event The event object.
         * @param {object} params The parameters for the fragment call.
         * @param {string} method The method to call in the fragment.
         */
        ZoomModal.zoomGraph = function (event, params, method) {
            let title = event.target.parentElement.dataset.title;

            Fragment.loadFragment('local_assessfreq', method, contextid, params)
            .done((response) => {
                let resObj = JSON.parse(response);
                if (resObj.hasdata == true) {
                    var context = { 'withtable' : false, 'chartdata' : JSON.stringify(resObj.chart), aspect: false};
                    modalObj.setTitle(title);
                    modalObj.setBody(Templates.render('local_assessfreq/chart', context));
                    modalObj.show();
                    return;
                } else {
                    Str.get_string('nodata', 'local_assessfreq').then((str) => {
                        const noDatastr = document.createElement('h3');
                        noDatastr.innerHTML = str;
                        modalObj.setTitle(title);
                        modalObj.setBody(noDatastr.outerHTML);
                        modalObj.show();
                        return;
                    }).catch(() => {
                        Notification.exception(new Error('Failed to load string: nodata'));
                    });
                }
            }).fail(() => {
                Notification.exception(new Error('Failed to load zoomed graph'));
                return;
            });

        };

        /**
         * Create the modal window for graph zooming.
         *
         * @private
         */
        const createModal = function () {
            return new Promise((resolve) => {
                Str.get_string('loading', 'core').then((title) => {
                    // Create the Modal.
                    Modal.create({
                        type: ModalLarge.TYPE,
                        title: title,
                        body: spinner,
                        large: true
                    })
                    .then((modal) => {
                        modalObj = modal;
                        resolve();
                    });
                }).catch(Notification.exception);
            });
        };

        /**
         * Initialise method for quiz dashboard rendering.
         *
         * @param {int} context The context id for the dashboard.
         */
        ZoomModal.init = function (context) {
            contextid = context;
            createModal();
        };

        return ZoomModal;
    }
);
