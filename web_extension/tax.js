window.browser = (function () {
	return window.msBrowser ||
		window.browser ||
		window.chrome;
})();

/*
	This method gets called when a content script asks us to do some work for them.
	We use this to allow communication from the options page via the background.js
	directly to this script.
*/

function onMessage(message) {
	if (message === 'REPAINT') {
		TaxRefunder.reset(true);
	}
}
browser.runtime.onMessage.addListener(onMessage);

/*
	This is our main class.
*/
function TaxRefunder() {
	this.doc = document;
	this.setCurrentUniverse();	
	this.setupSettingsForCurrentUniverse();
}

TaxRefunder.prototype.init = function() {
	this.pilotActivity = {};

	// Add an id to the pilot tax table
	this.insertPoint = this.doc.getElementsByTagName('TABLE')[5];
	this.insertPoint.setAttribute('id', 'pilotTaxTable');
	if (this.insertPoint.rows.length - 1 === 0) {
		this.insertPoint.style.display = 'none';
	} else {
		this.fetchMembershipOnlineActivityStatus();
	}
	this.addDeleteTaxRecordLink();
}

// Send a request to the alliance members page and calculate pilot activity
TaxRefunder.prototype.fetchMembershipOnlineActivityStatus = function() {
	var url = this.doc.location.protocol + '//' + this.doc.location.hostname + '/' + 'alliance_members.php';
	var http = new XMLHttpRequest();
		
	http.open('GET', url, true);
	http.onreadystatechange = function() {
		if (http.readyState == 4) {
			if (http.status == 200) {		
				var tables = parseXHTTPResponseText(http.responseText).querySelectorAll('table');
				var tblNode = tables[5];
				this.pilotActivity = {};
				for (let loop = 1; loop < tblNode.rows.length; loop++) {
					var pilotName = tblNode.rows[loop].cells[0].textContent.strim();
					var activity = tblNode.rows[loop].cells[5].getElementsByTagName('SPAN')[0].innerHTML.replace(/<br>|\&nbsp;/g,' ').replace(/<b>|<\/b>|ago/g,'').replace(/\s\s*/g,' ');
					
					for (var i=0; i<this['strMemberActivity' + this.universe].length; i++) {
						activity = activity.replace(this['strMemberActivity' + this.universe][i], 'OK');
					}
					activity = activity.strim();
					var _pilotId = tblNode.rows[loop].cells[0].getElementsByTagName('IMG')[0].getAttribute('onclick');
					var pilotId = _pilotId.substring(_pilotId.indexOf('profile.php?id=')+'profile.php?id='.length,_pilotId.length-2);
					this.pilotActivity[pilotName] = {'activity':activity, 'id':pilotId};
				}
				this.insertTaxRefundTableIntoPage();
			}
		}
	}.bind(this);
	http.send(null);
}

TaxRefunder.prototype.insertTaxRefundTableIntoPage = function() {
	let insertPoint = this.doc.getElementById('pilotTaxTable');
	let tableBackground = insertPoint.getAttribute('style');
 	insertPoint.style.display = 'none';
	if (insertPoint.rows.length-1 > 0) {
		// wrapper for our new page items
		var taxRefundsNode = this.doc.createElement('DIV');
		taxRefundsNode.setAttribute('id','taxRefundAssistantWrapper');
		insertPoint.parentNode.insertBefore(taxRefundsNode, insertPoint);

		// instructions
		var instructionsEl = this.doc.createElement('TABLE');
		instructionsEl.setAttribute('id','taxRefundAssistantInfo');
		instructionsEl.setAttribute('style',tableBackground);
		instructionsEl.setAttribute('class','messagestyle');
		this.addInstructionsNodes(instructionsEl);
		taxRefundsNode.appendChild(instructionsEl);

		// collected tax summary for all pilots from the current tax record
		var summaryNode = this.doc.createElement('TABLE');
		summaryNode.setAttribute('id','pilotActivitySummaryTable');
		summaryNode.setAttribute('style',tableBackground);
		summaryNode.setAttribute('class','messagestyle');
		this.getTaxRefundSummaryTableHTML(summaryNode);
		taxRefundsNode.appendChild(summaryNode);

		// buttons to refund individual pilots
		var buttonsNode = this.doc.createElement('TABLE');
		buttonsNode.setAttribute('id','pilotActivityRefundTable');
		buttonsNode.setAttribute('class','messagestyle');
		this.getRefundButtonHTML(buttonsNode);
		taxRefundsNode.appendChild(buttonsNode);

		// attach our button click events
		this.doc.getElementById('RefundRemoveAll').addEventListener('click', this.refundAllActivePilots.bind(this), false);
		buttonsNode.addEventListener('click', this.handleClickInRefundTable.bind(this), false);
	}
}

// instructions
TaxRefunder.prototype.addInstructionsNodes = function(tableEl) {
	let trEl;
	let tdEl;
	let pEl;
	
	if (this['boolEnableLevyToggle' + this.universe]) {
		trEl = this.doc.createElement('TR');
		tdEl = this.doc.createElement('TD');
		pEl = this.doc.createElement('P');
		pEl.id = 'levyRow';
		pEl.textContent = 'You have chosen to apply a levy from each pilot (that can afford it). This is currently set to: ' + addCommas(this['strFlatTaxValue' + this.universe]) + ' credits.';
		tdEl.appendChild(pEl);
		pEl = this.doc.createElement('P');
		pEl.classList.add('instructions');
		pEl.textContent = 'Note that if the amount to be levied is less than the total amount of tax collected, then the levy will be deducted from the tax collected from them - and the remaining amount refunded. Otherwise they will receive the full amount of the tax collected as a refund.';
		tdEl.appendChild(pEl);
		trEl.appendChild(tdEl);
		tableEl.appendChild(trEl);
	}
	
	trEl = this.doc.createElement('TR');
		tdEl = this.doc.createElement('TD');
			pEl = this.doc.createElement('P');
			pEl.id = 'refundRemoveDirections';
			pEl.textContent = 'You can refund individual pilots using the "Refund and Remove" button beside each pilot, or you can perform this process on all active pilots at once by clicking the "Refund and Remove for all Active Pilots" button below.';
		tdEl.appendChild(pEl);
	trEl.appendChild(tdEl);
	tableEl.appendChild(trEl);
	
	trEl = this.doc.createElement('TR');
		tdEl = this.doc.createElement('TD');
		tdEl.setAttribute('class', 'buttons');
			let btnEl = this.doc.createElement('BUTTON');
			btnEl.id = 'RefundRemoveAll';
			btnEl.textContent = 'Refund and Remove for all Active Pilots';
			let spanEl = this.doc.createElement('SPAN');
			spanEl.id = 'feedbackSpan';
		tdEl.appendChild(btnEl);
		tdEl.appendChild(spanEl);
	trEl.appendChild(tdEl);
	tableEl.appendChild(trEl);
	trEl = this.doc.createElement('TR');
		tdEl = this.doc.createElement('TD');
			pEl = this.doc.createElement('P');
			pEl.textContent = 'When you have finished processing the refunds, click the red "Delete Tax Record" button to reset the tax record and begin collecting records for the next tax period.';
		tdEl.appendChild(pEl);
	trEl.appendChild(tdEl);
	tableEl.appendChild(trEl);
}

// tax refund summary table
TaxRefunder.prototype.getTaxRefundSummaryTableHTML = function(tableEl) {
	let trEl;
	let thEl;
	let tdEl;
	let labelEl;
	let spanEl;

	// add in the table column headings
	trEl = this.doc.createElement('TR');
	thEl = this.doc.createElement('TH');
		thEl.classList.add('col1');
		thEl.textContent = 'Pilot';
	trEl.appendChild(thEl);
	thEl = this.doc.createElement('TH');
		thEl.classList.add('col2');
		thEl.textContent = 'Current Activity';
	trEl.appendChild(thEl);
	thEl = this.doc.createElement('TH');
		thEl.classList.add('col3');
		thEl.textContent = 'Total Tax Paid';
	trEl.appendChild(thEl);
	// only include the Levy column if it is enabled for the current universe
	if (this['boolEnableLevyToggle' + this.universe]) {
		thEl = this.doc.createElement('TH');
			thEl.classList.add('col4');
			thEl.textContent = 'Levy to pay';
		trEl.appendChild(thEl);
	}
	thEl = this.doc.createElement('TH');
		thEl.classList.add('col5');
		thEl.textContent = 'Refund Due';
	trEl.appendChild(thEl);
	tableEl.appendChild(trEl);

	for (var loop=1; loop<this.insertPoint.rows.length-1; loop++) {
		var pilotName = this.insertPoint.rows[loop].cells[0].textContent;
		var pilotActiveStatus = this.pilotActivity[pilotName].activity;
		var taxedAmount = this.insertPoint.rows[loop].cells[2].textContent;
		var _pilotId = this.insertPoint.rows[loop].cells[3].getElementsByTagName('A')[0].href;
		var pilotId = _pilotId.substr(_pilotId.indexOf('?cdel=') + 6);

		var tax_levy = 0;
		if (this['boolEnableLevyToggle' + this.universe]) {
			tax_levy = this['strFlatTaxValue' + this.universe];
			if (isNaN(parseInt(tax_levy, 10))) tax_levy = 0;
			if (parseInt(taxedAmount.replace(/,/g,''), 10) <= tax_levy) tax_levy = 0;
		}

		var refundDue = parseInt(taxedAmount.replace(/,/g,''), 10) - tax_levy;
		if (pilotActiveStatus != 'OK') refundDue = 0;

		trEl = this.doc.createElement('TR');
		if (pilotActiveStatus !== 'OK') {
			trEl.classList.add('inactive');
		}	
		tdEl = this.doc.createElement('TD');
			tdEl.classList.add('col1');
			tdEl.textContent = pilotName;
		trEl.appendChild(tdEl);
		tdEl = this.doc.createElement('TD');
			tdEl.classList.add('col2');
			tdEl.textContent = pilotActiveStatus;
		trEl.appendChild(tdEl);
		tdEl = this.doc.createElement('TD');
			tdEl.classList.add('col3');
			tdEl.textContent = taxedAmount;
		trEl.appendChild(tdEl);

		if (this['boolEnableLevyToggle' + this.universe]) {
			tdEl = this.doc.createElement('TD');
				tdEl.classList.add('col4');
				labelEl = this.doc.createElement('LABEL');
				spanEl = this.doc.createElement('SPAN');
					spanEl.textContent = addCommas(tax_levy);
				labelEl.appendChild(spanEl);
				tdEl.appendChild(labelEl);
			trEl.appendChild(tdEl);
		}
		tdEl = this.doc.createElement('TD');
			tdEl.classList.add('col5');
			tdEl.textContent = addCommas(refundDue);
		trEl.appendChild(tdEl);
		tableEl.appendChild(trEl);
	}
}

// buttons to refund individual pilots
TaxRefunder.prototype.getRefundButtonHTML = function(tableEl) {
	let trEl;
	let thEl;
	let tdEl;
	let buttonEl;

	// add in the table column headings
	trEl = this.doc.createElement('TR');
	thEl = this.doc.createElement('TH');
		thEl.classList.add('col1');
		
		buttonEl = this.doc.createElement('BUTTON');
			buttonEl.id = 'ShowActive';
			buttonEl.setAttribute('showing', 'visible');
			buttonEl.classList.add('visible');
			buttonEl.textContent = 'Hide Active';
		thEl.appendChild(buttonEl);
		
		buttonEl = this.doc.createElement('BUTTON');
			buttonEl.id = 'ShowAll';
			buttonEl.setAttribute('showing', 'hidden');
			buttonEl.textContent = 'Show All';
		thEl.appendChild(buttonEl);
	trEl.appendChild(thEl);
	tableEl.appendChild(trEl);

	for (var loop=1; loop<this.insertPoint.rows.length-1; loop++) {
		var pilotName = this.insertPoint.rows[loop].cells[0].textContent;
		var pilotActiveStatus = this.pilotActivity[pilotName].activity;
		var taxedAmount = this.insertPoint.rows[loop].cells[2].textContent;
		var _pilotId = this.insertPoint.rows[loop].cells[3].getElementsByTagName('A')[0].href;
		var pilotId = _pilotId.substr(_pilotId.indexOf('?cdel=') + 6);

		var tax_levy = 0;
		if (this['boolEnableLevyToggle' + this.universe]) {
			tax_levy = this['strFlatTaxValue' + this.universe];
			if (isNaN(parseInt(tax_levy, 10))) tax_levy = 0;
			if (parseInt(taxedAmount.replace(/,/g,''), 10) <= tax_levy) tax_levy = 0;
		}

		var refundDue = parseInt(taxedAmount.replace(/,/g,''), 10) - tax_levy;
		
		trEl = this.doc.createElement('TR');
		tdEl = this.doc.createElement('TD');
			tdEl.classList.add('col1');
			buttonEl = this.doc.createElement('BUTTON');
				buttonEl.textContent = 'Refund and Remove';
				buttonEl.setAttribute('pilotId', pilotId);
				buttonEl.setAttribute('fixedLevy', tax_levy);
				buttonEl.setAttribute('refundAmount', refundDue);
				buttonEl.setAttribute('pilotActiveStatus', pilotActiveStatus);
				buttonEl.classList.add( pilotActiveStatus === 'OK' ? 'visible' : 'hidden' );
			tdEl.appendChild(buttonEl);
		trEl.appendChild(tdEl);

		tableEl.appendChild(trEl);
	}
};

TaxRefunder.prototype.refundAllActivePilots = function(e) {
	// disable the refund all pilots button
	refundAllButton = e.target;
	refundAllButton.setAttribute('disabled','disabled');
	refundAllButton.setAttribute('class','disabled');
	
	// disable all buttons in the activity refund table
	var buttons = this.doc.querySelectorAll('#pilotActivityRefundTable button');
	for (var loop=0; loop<buttons.length; loop++) {
		buttons[loop].setAttribute('disabled','disabled');
		buttons[loop].setAttribute('class','disabled');
	}

	var totalRefunded = 0;
	var totalLevyRetained = 0;
	var totalRetained = 0;
	
	let millisecondsToThrottle = 50; // when set to 20ms it appeared to get "500" page errors for large (200+) alliances
	let timeoutMilliseconds = 0;
	
	buttons = this.doc.querySelectorAll('#pilotActivityRefundTable td button');
	for (var loop=0; loop<buttons.length; loop++) {
		var pilotActiveStatus = buttons[loop].getAttribute('pilotActiveStatus');
		var refundAmount = buttons[loop].getAttribute('refundAmount').replace(/[^0123456789]/g,'');
		var fixedLevy = parseInt(buttons[loop].getAttribute('fixedLevy').replace(/[^0123456789]/g,''), 10);
		if (pilotActiveStatus === 'OK') {
			var pilotId = buttons[loop].getAttribute('pilotId').replace(/[^0123456789]/g,'');
			if (parseInt(pilotId) == pilotId && !isNaN(parseInt(refundAmount))) {

				totalRefunded += parseInt(refundAmount);
				totalLevyRetained += parseInt(fixedLevy);

				let levyMsg = 'Tax refund';
				if (this['boolEnableLevyToggle' + this.universe]) {
					if (fixedLevy === 0) {
						levyMsg = 'You received a full tax refund - no levy taken.';
					} else {
						levyMsg += ' - the alliance retained ' + addCommas(fixedLevy) + ' credits levy.';
					}
				}
				
				let _pilotId = pilotId;
				let _refundAmount = refundAmount;
				let _levyMsg = levyMsg;
				
				setTimeout(() => {
					this.sendRefundToPilot(_pilotId, _refundAmount, _levyMsg);
				}, timeoutMilliseconds);
				timeoutMilliseconds += millisecondsToThrottle;
			}
		} else {
			totalRetained += parseInt(fixedLevy);
			totalRetained += parseInt(refundAmount);
		}
	}

	this.doc.getElementById('refundRemoveDirections').style.display = 'none';
	this.doc.getElementById('pilotActivitySummaryTable').style.display = 'none';
	this.doc.getElementById('pilotActivityRefundTable').style.display = 'none';

	var tableEl = this.doc.getElementById('taxRefundAssistantInfo');
		var trEl = this.doc.createElement('TR');
			trEl.id = 'taxRefundWorking';
		var tdEl = this.doc.createElement('TD');
			tdEl.style.fontStyle = 'italic';
			tdEl.style.color = '#cccccc';
			tdEl.style.fontSize = '13px';
			var pEl = this.doc.createElement('P');
				pEl.textContent = 'Please wait while the taxes are refunded (' + Math.ceil(timeoutMilliseconds/1000) + ' seconds)';
		tdEl.appendChild(pEl);
		trEl.appendChild(tdEl);
	tableEl.appendChild(trEl);

		trEl = this.doc.createElement('TR');
			trEl.id = 'taxRefundBreakdown';
			trEl.style.display = 'none';
		tdEl = this.doc.createElement('TD');
			tdEl.style.fontStyle = 'italic';
			tdEl.style.color = '#cccccc';
			tdEl.style.fontSize = '13px';
			pEl = this.doc.createElement('P');
				pEl.textContent = addCommas(totalRefunded) + ' credits were refunded and ' + addCommas(totalRetained) + ' credits were retained.';
		tdEl.appendChild(pEl);
	if (this['boolEnableLevyToggle' + this.universe]) {
			pEl = this.doc.createElement('P');
			pEl.textContent = 'A total of ' + addCommas(totalLevyRetained) + ' credits were levied from those pilots that could afford it.';
		tdEl.appendChild(pEl);
	}
	trEl.appendChild(tdEl);
	tableEl.appendChild(trEl);
	
	setTimeout(() => {
		this.doc.getElementById('taxRefundWorking').style.display = 'none';
		this.doc.getElementById('taxRefundBreakdown').style.display = 'block';
	}, timeoutMilliseconds);
}

TaxRefunder.prototype.handleClickInRefundTable = function(e) {
	if (e.target.nodeName === 'BUTTON' && !e.target.classList.contains('disabled')) {
		let refundButton = e.target;
		if (refundButton.getAttribute('id') === 'ShowActive' || refundButton.getAttribute('id') === 'ShowAll') {
			this.toggleRefundButtons(refundButton);
		} else {
			refundButton.setAttribute('disabled','disabled');
			refundButton.setAttribute('class','disabled');
			var pilotId = refundButton.getAttribute('pilotId').replace(/[^0123456789]/g,'');
			var refundAmount = refundButton.getAttribute('refundAmount').replace(/[^0123456789]/g,'');
			var fixedLevy = parseInt(refundButton.getAttribute('fixedLevy').replace(/[^0123456789]/g,''), 10);
			if (parseInt(pilotId) == pilotId && !isNaN(parseInt(refundAmount))) {
				let levyMsg = 'Tax refund';
				if (this['boolEnableLevyToggle' + this.universe]) {
					if (fixedLevy === 0) {
						levyMsg = 'You received a full tax refund - no levy taken.';
					} else {
						levyMsg += ' - the alliance retained ' + addCommas(fixedLevy) + ' credits levy.';
					}
				}
				this.sendRefundToPilot(pilotId, refundAmount, levyMsg);
			}
		}
	}
}

TaxRefunder.prototype.toggleRefundButtons = function(toggleButton) {
	if (toggleButton.getAttribute('class') != 'disabled') {
		var showing = toggleButton.getAttribute('showing');
		if (showing == 'hidden') {
			showing = 'visible';
		} else {
			showing = 'hidden';
		}
		var buttonId = toggleButton.getAttribute('id');
		if (buttonId === 'ShowAll') {
			document.getElementById('ShowActive').setAttribute('showing','hidden');
			document.getElementById('ShowActive').setAttribute('class','hidden');
			document.getElementById('ShowActive').textContent = 'Show Active';
		} else
		if (buttonId === 'ShowActive') {
			document.getElementById('ShowAll').setAttribute('showing','hidden');
			document.getElementById('ShowAll').setAttribute('class','hidden');
			document.getElementById('ShowAll').textContent = 'Show All';
		}
		var buttons = document.querySelectorAll('#pilotActivityRefundTable td button');
		for (var loop=0; loop<buttons.length; loop++) {
			var _showing = showing;
			if (buttonId === 'ShowActive') {
				if (buttons[loop].getAttribute('pilotActiveStatus') !== 'OK') {
					_showing = 'hidden';
				}
			}
			buttons[loop].setAttribute('class', _showing);
		}
		toggleButton.setAttribute('showing', showing);
		toggleButton.setAttribute('class', showing);
		var buttonValue = (showing === 'visible' ? 'Hide' : 'Show') + (buttonId === 'ShowActive' ? ' Active' : ' All');
		toggleButton.textContent = buttonValue;
	}
}

// Send a request to refund a pilot the tax collected from them
TaxRefunder.prototype.sendRefundToPilot = function(pilotId, refundAmount, msg) {
	var http = new XMLHttpRequest();
	var url = this.doc.location.protocol + '//' + this.doc.location.hostname + '/' + 'alliance_funds.php';
	var params = '';
		params += 'player=' + pilotId;
		params += '&credits=' + refundAmount;
		params += '&reason=' + msg;
	http.open("POST", url, true);
	http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	http.onreadystatechange = function() {
		if (http.readyState == 4 && http.status == 200) {
			this.removeEntryInTaxTableForAPilot(pilotId);			
		}
	}.bind(this);
	http.send(params);
}

// Send a request to remove an entry for a pilot from the current tax log
TaxRefunder.prototype.removeEntryInTaxTableForAPilot = function(pilotId) {
	var http = new XMLHttpRequest();
	var url = this.doc.location.protocol + '//' + this.doc.location.hostname + '/' + 'alliance_funds.php';
	var params = '';
		params += 'del=' + pilotId;
		params += '&yes=Yes';
	http.open("POST", url, true);
	http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	http.send(params);
}

// Introduce a button to remove the current tax record
TaxRefunder.prototype.addDeleteTaxRecordLink = function() {
	let deleteNode = this.doc.createElement('DIV');
	deleteNode.setAttribute('id', 'deleteTaxRecord');
	
	let formEl = this.doc.createElement('FORM');
		formEl.setAttribute('action', 'alliance_funds.php');
		formEl.setAttribute('method', 'post');
		formEl.style.display = 'inline';
		
		let inputEl = this.doc.createElement('INPUT');
			inputEl.setAttribute('type', 'hidden');
			inputEl.setAttribute('value', '1');
			inputEl.setAttribute('name', 'delall');
			
		formEl.appendChild(inputEl);

		inputEl = this.doc.createElement('INPUT');
			inputEl.setAttribute('type', 'submit');
			inputEl.setAttribute('value', 'Delete Tax Record');
			inputEl.setAttribute('name', 'yes');
			
		formEl.appendChild(inputEl);
			
	deleteNode.appendChild(formEl);
	
	formEl.addEventListener('submit', function(e) {
		if (!confirm('Are you certain that you wish to delete the current tax record?')) {
			e.preventDefault();
		}
	});
	
	this.insertPoint.parentNode.insertBefore(deleteNode, this.insertPoint);
}

// Trim whitespace from before and after a string
String.prototype.strim = function() {
	return this.replace(/(^\s*)|(\s*$)/g, "");
}

// Return the body of the responseText as an HTML fragment
function parseXHTTPResponseText(data) {
	// Strip out any markup before the <body> element
	var httpRT = data.replace(/^.*\>(?=<body\b)/, '');
	var fragment = document.createRange().createContextualFragment(httpRT);
	return fragment;
}

function addCommas(input) {
	if (isNaN(input)) return input; // fast fail if not a number
	var strungNum = new String(input);
	if (strungNum.match(/[^[0-9].]+/g)) return input; // fast fail if any characters other than 0-9 and . are present
	// if the number is less than 1000 then we do nothing to the data passed in
	if (strungNum < 1000) return input;
	// our input is considered satisfactory, so we add in the commas
	var fraction = (strungNum.indexOf('.')>-1) ? strungNum.substr(strungNum.indexOf('.')) : '';
	var wholeNum = strungNum.substr(0,(strungNum.indexOf('.')>-1)?strungNum.indexOf('.'):strungNum.length);
	// turn it into an array
	var a = wholeNum.split('');
	// loop through and get 3 at a time and append with commas
	for (var loop=a.length-3; loop>0; loop-=3) a.splice(loop, 0, ',');
	return a.join('') + fraction;
}

TaxRefunder.prototype.reset = function(delay) {
	this.setupSettingsForCurrentUniverse();
	if (delay) {
		setTimeout(this._reload.bind(this), 60);
	} else {
		this._reload();
	}
}

TaxRefunder.prototype._reload = function() {
	this.loadPage('main.php');
}

TaxRefunder.prototype.loadPage = function(page) {
	this.doc.location.href = this.doc.location.protocol + '//' + this.doc.location.hostname + '/' + page;
}

TaxRefunder.prototype.getPref = function(key, defValue) {
	let result = null;
	if (typeof(Storage) !== "undefined") {
	    let value = localStorage.getItem(key + this.universe);
	    if (value === null) {
	    	result = typeof(defValue) !== 'undefined' ? defValue : null;
	    } else {
			let type = value[0];
			value = value.substring(1);
			switch (type) {
				case 'b': result = value === 'true';
				case 'n': result = Number(value);
				default: result = value;
			}
		}
	}
	return result;
}

TaxRefunder.prototype.setPref = function(key, value) {
	if (typeof(Storage) !== "undefined") {
		let _value = (typeof value)[0] + value;
		localStorage.setItem(key + this.universe, _value);
	}
}

TaxRefunder.prototype.setCurrentUniverse = function() {
	let universe = this.doc.location.hostname.substring(0, this.doc.location.hostname.indexOf('.')).toLowerCase();
	this.universe = universe.substring(0, 1).toUpperCase() + universe.substring(1);
}

TaxRefunder.prototype.buildActivityArray = function(activity) {
	let activityArr = ['less than 1 week'];
	switch (activity) {
		case 'more than 1 week':
			activityArr.push('more than 1 week');
			break;
		case 'more than 1 month':
			activityArr.push('more than 1 week');
			activityArr.push('more than 1 month');
			break;
	}
	return activityArr;
}

TaxRefunder.prototype.setupSettingsForCurrentUniverse = function() {
	browser.storage.local.get({
	
		boolEnableLevyToggleOrion: false,
		strFlatTaxValueOrion: '10000',
		strMemberActivityOrion: 'less than 1 week',

		boolEnableLevyToggleArtemis: false,
		strFlatTaxValueArtemis: '10000',
		strMemberActivityArtemis: 'less than 1 week',

		boolEnableLevyTogglePegasus: false,
		strFlatTaxValuePegasus: '10000',
		strMemberActivityPegasus: 'less than 1 week'

	}, function(items) {
	
		this.boolEnableLevyToggleOrion = items.boolEnableLevyToggleOrion;
		this.strFlatTaxValueOrion = items.strFlatTaxValueOrion;
		this.strMemberActivityOrion = this.buildActivityArray(items.strMemberActivityOrion);
		
		this.boolEnableLevyToggleArtemis = items.boolEnableLevyToggleArtemis;
		this.strFlatTaxValueArtemis = items.strFlatTaxValueArtemis;
		this.strMemberActivityArtemis = this.buildActivityArray(items.strMemberActivityArtemis);
		
		this.boolEnableLevyTogglePegasus = items.boolEnableLevyTogglePegasus;
		this.strFlatTaxValuePegasus = items.strFlatTaxValuePegasus;
		this.strMemberActivityPegasus = this.buildActivityArray(items.strMemberActivityPegasus);

	}.bind(this));
}

let taxRefunder = new TaxRefunder();

let readyStateCheckInterval = setInterval(function() {
	if (document.readyState === "complete") {
		clearInterval(readyStateCheckInterval);
		taxRefunder.init();
	}
}, 20);
