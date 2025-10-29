$(document).ready(function() {
    const showSection = (sectionId) => {
        $('.main-section').hide();
        $(`#${sectionId}`).show();
    };

    const resetFormToCurrentCredentials = () => {
        const currentCredentials = loadCredentials();
        $('#geminiApiKey').val(currentCredentials.geminiApiKey);
        $('#langcacheServerUrl').val(currentCredentials.langcacheServerUrl);
        $('#langcacheCacheId').val(currentCredentials.langcacheCacheId);
        $('#langcacheApiKey').val(currentCredentials.langcacheApiKey);
    };
    
    const saveCredentials = (credentials) => {
        sessionStorage.setItem('geminiApiKey', credentials.geminiApiKey);
        sessionStorage.setItem('langcacheServerUrl', credentials.langcacheServerUrl);
        sessionStorage.setItem('langcacheCacheId', credentials.langcacheCacheId);
        sessionStorage.setItem('langcacheApiKey', credentials.langcacheApiKey);
    };
    
    const loadCredentials = () => {
        const geminiApiKey = sessionStorage.getItem('geminiApiKey') || '';
        const langcacheServerUrl = sessionStorage.getItem('langcacheServerUrl') || '';
        const langcacheCacheId = sessionStorage.getItem('langcacheCacheId') || '';
        const langcacheApiKey = sessionStorage.getItem('langcacheApiKey') || '';
        
        if (geminiApiKey) $('#geminiApiKey').val(geminiApiKey);
        if (langcacheServerUrl) $('#langcacheServerUrl').val(langcacheServerUrl);
        if (langcacheCacheId) $('#langcacheCacheId').val(langcacheCacheId);
        if (langcacheApiKey) $('#langcacheApiKey').val(langcacheApiKey);
        
        return { geminiApiKey, langcacheServerUrl, langcacheCacheId, langcacheApiKey };
    };

    const credentials = loadCredentials();
    const hasCredentials = credentials.geminiApiKey || credentials.langcacheCacheId;

    if (hasCredentials) {
        $('#configSection').hide();
        $('#querySection').show();
    } else {
        $('#configSection').show();
        $('#querySection').hide();
    }

    $('#showConfigBtn').on('click', function() {
        resetFormToCurrentCredentials();
        showSection('configSection');
    });

    $('#cancelConfigBtn').on('click', function() {
        resetFormToCurrentCredentials();
        
        const currentCredentials = loadCredentials();
        if (currentCredentials.geminiApiKey || currentCredentials.langcacheCacheId) {
            $('#configSection').hide();
            $('#querySection').show();
        } else {
            showError('You must configure your credentials to continue');
        }
    });

    $('#configForm').on('submit', function(e) {
        e.preventDefault();
        
        const credentials = {
            geminiApiKey: $('#geminiApiKey').val().trim(),
            langcacheServerUrl: $('#langcacheServerUrl').val().trim(),
            langcacheCacheId: $('#langcacheCacheId').val().trim(),
            langcacheApiKey: $('#langcacheApiKey').val().trim()
        };
        
        if (!credentials.geminiApiKey && !credentials.langcacheCacheId) {
            showError('Please provide at least a Gemini API Key or a LangCache Cache ID');
            return;
        }
        
        saveCredentials(credentials);
        showError('Configuration saved successfully! You can now send queries.', 'success');
        
        setTimeout(() => {
            $('#configSection').hide();
            $('#querySection').show();
        }, 1500);
    });

    $('#queryForm').on('submit', async function(e) {
        e.preventDefault();
        
        const query = $('#queryInput').val().trim();
        if (!query) {
            showError('Please enter a query');
            return;
        }
        
        const credentials = loadCredentials();
        if (!credentials.geminiApiKey && !credentials.langcacheCacheId) {
            showSection('configSection');
            showError('Please configure your credentials first');
            return;
        }
        
        $('#loading').show();
        $('#resultsSection, #error').hide();
        $('#submitBtn').prop('disabled', true);
        
        try {
            const payload = { query, credentials };
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Authentication failed. Please check your credentials.');
                } else {
                    throw new Error(`Server responded with status ${response.status}`);
                }
            }
            
            const data = await response.json();
            displayResults(data);
        } catch (err) {
            showError(err.message || 'An error occurred while processing your query');
        } finally {
            $('#loading').hide();
            $('#submitBtn').prop('disabled', false);
        }
    });
    
    const displayResults = (data) => {
        $('#responseContent').text(data.response);
        
        const responseInfoHTML = `
            <div class="info-item flex flex-wrap gap-x-4 gap-y-2">
                <div>
                    <span class="info-label font-semibold text-gray-700">Source</span>
                    <span class="info-value ml-2 ${data.source === 'cache' ? 'text-green-600' : 'text-red-600'} font-medium">
                        ${data.source}
                    </span>
                </div>
                <div>
                    <span class="info-label font-semibold text-gray-700">Similarity</span>
                    <span class="info-value ml-2 font-medium">${(data.similarity * 100).toFixed(2)}%</span>
                </div>
                <div>
                    <span class="info-label font-semibold text-gray-700">Time Taken</span>
                    <span class="info-value ml-2 font-medium">${data.responseTime}</span>
                </div>
                <div>
                    <span class="info-label font-semibold text-gray-700">Timestamp</span>
                    <span class="info-value ml-2 font-medium">${new Date(data.timestamp).toLocaleString()}</span>
                </div>
            </div>
        `;
        
        $('#responseInfo').html(responseInfoHTML);
        
        const responseContainer = $('#responseContainer');
        responseContainer.find('.similar-queries').remove();
        
        if (data.similarQueries?.length > 0) {
            let similarQueriesHTML = `
                <div class="similar-queries mt-6 pt-6 border-t border-gray-200">
                    <details class="similar-queries-details">
                        <summary class="cursor-pointer font-semibold text-gray-700 mb-3 flex items-center">
                            <svg class="w-4 h-4 mr-2 transition-transform duration-200 ease-in-out" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                            <span>Similar Queries (${data.similarQueries.length})</span>
                        </summary>
                        <div class="similar-queries-list space-y-3 mt-3">
            `;
            
            data.similarQueries.forEach(queryObj => {
                similarQueriesHTML += `
                    <div class="similar-query-item bg-gray-100 p-3 rounded-lg">
                        <div class="similar-query-prompt">
                            <strong>Query:</strong> ${queryObj.prompt}
                        </div>
                        <div class="similar-query-response mt-2">
                            <strong>Response:</strong> ${queryObj.response}
                        </div>
                        <div class="similar-query-similarity mt-2 font-semibold text-green-600">
                            <strong>Similarity:</strong> ${(queryObj.similarity * 100).toFixed(2)}%
                        </div>
                    </div>
                `;
            });
            
            similarQueriesHTML += `
                        </div>
                    </details>
                </div>
            `;
            
            responseContainer.append(similarQueriesHTML);
            
            const detailsElement = responseContainer.find('.similar-queries-details')[0];
            const icon = responseContainer.find('svg')[0];
            
            detailsElement.addEventListener('toggle', function() {
                if (this.open) {
                    icon.style.transform = 'rotate(180deg)';
                } else {
                    icon.style.transform = 'rotate(0deg)';
                }
            });
        }
        
        showSection('resultsSection');
    };
    
    const showError = (message, type = 'error') => {
        $('#errorMessage').text(message);
        $('#error').show();
        
        const errorClass = type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg'
            : 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg';
        
        $('#error').attr('class', errorClass);
        $('#resultsSection').hide();
    };
});