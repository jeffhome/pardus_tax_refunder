window.browser = (function () {
	return window.msBrowser ||
		window.browser ||
		window.chrome;
})();

if (navigator.userAgent.indexOf('Chrome') > -1) {
	let _bodyEl = document.querySelector('body');
	_bodyEl.classList.add('chrome');
}

function save_options() {

	browser.storage.local.set({

		boolEnableLevyToggleOrion : document.getElementById('boolEnableLevyToggleOrion').checked,
		strFlatTaxValueOrion : document.getElementById('strFlatTaxValueOrion').value,
		strMemberActivityOrion : document.getElementById('strMemberActivityOrion').value,

		boolEnableLevyToggleArtemis : document.getElementById('boolEnableLevyToggleArtemis').checked,
		strFlatTaxValueArtemis : document.getElementById('strFlatTaxValueArtemis').value,
		strMemberActivityArtemis : document.getElementById('strMemberActivityArtemis').value,

		boolEnableLevyTogglePegasus : document.getElementById('boolEnableLevyTogglePegasus').checked,
		strFlatTaxValuePegasus : document.getElementById('strFlatTaxValuePegasus').value,
		strMemberActivityPegasus : document.getElementById('strMemberActivityPegasus').value

	}, function() {
		// Update status to let user know options were saved.
		browser.runtime.sendMessage('REPAINT');
		
		let status = document.getElementById('status');
		status.textContent = 'Options saved';
		setTimeout(function() {
			status.textContent = '';
		}, 750);
	});
}

function restore_options() {

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

		document.getElementById('boolEnableLevyToggleOrion').checked = items.boolEnableLevyToggleOrion;
		document.getElementById('strFlatTaxValueOrion').value = items.strFlatTaxValueOrion;
		document.getElementById('strMemberActivityOrion').value = items.strMemberActivityOrion;

		document.getElementById('boolEnableLevyToggleArtemis').checked = items.boolEnableLevyToggleArtemis;
		document.getElementById('strFlatTaxValueArtemis').value = items.strFlatTaxValueArtemis;
		document.getElementById('strMemberActivityArtemis').value = items.strMemberActivityArtemis;

		document.getElementById('boolEnableLevyTogglePegasus').checked = items.boolEnableLevyTogglePegasus;
		document.getElementById('strFlatTaxValuePegasus').value = items.strFlatTaxValuePegasus;
		document.getElementById('strMemberActivityPegasus').value = items.strMemberActivityPegasus;

	});
}

function toggle_settings_visibility(e) {
	document.getElementById('orion_settings_list').className = e.currentTarget.id === 'orion_settings' ? 'show' : '';
	document.getElementById('artemis_settings_list').className = e.currentTarget.id === 'artemis_settings' ? 'show' : '';
	document.getElementById('pegasus_settings_list').className = e.currentTarget.id === 'pegasus_settings' ? 'show' : '';
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

document.getElementById('orion_settings').addEventListener('click', toggle_settings_visibility);
document.getElementById('artemis_settings').addEventListener('click', toggle_settings_visibility);
document.getElementById('pegasus_settings').addEventListener('click', toggle_settings_visibility);


