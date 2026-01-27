import { useState, useEffect, useCallback } from 'react';

// Types for the Google Picker API
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

interface UseGooglePickerProps {
    clientId: string;
    developerKey: string;
    viewId?: string; // e.g., 'SPREADSHEETS'
    onSelect: (file: { id: string; name: string; accessToken: string }) => void;
    onCancel?: () => void;
}

export function useGooglePicker({
    clientId,
    developerKey,
    viewId = 'SPREADSHEETS',
    onSelect,
    onCancel,
}: UseGooglePickerProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
    const [gisLoaded, setGisLoaded] = useState(false);
    const [tokenClient, setTokenClient] = useState<any>(null);

    // Load the scripts
    useEffect(() => {
        const loadScripts = async () => {
            // Load GAPI
            if (!window.gapi) {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    window.gapi.load('picker', { callback: () => setPickerApiLoaded(true) });
                };
                document.body.appendChild(script);
            } else {
                window.gapi.load('picker', { callback: () => setPickerApiLoaded(true) });
            }

            // Load GIS
            if (!window.google?.accounts) {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => setGisLoaded(true);
                document.body.appendChild(script);
            } else {
                setGisLoaded(true);
            }
        };

        loadScripts();
    }, []);

    // Initialize Token Client once scripts are loaded
    useEffect(() => {
        if (pickerApiLoaded && gisLoaded && !tokenClient) {
            if (!window.google?.accounts?.oauth2) {
                console.error('Google Accounts OAuth2 library not loaded');
                return;
            }

            try {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: '', // defined at request time
                });
                setTokenClient(client);
                setIsLoaded(true);
            } catch (error) {
                console.error('Error initializing Token Client:', error);
            }
        }
    }, [pickerApiLoaded, gisLoaded, clientId, tokenClient]);

    const openPicker = useCallback(() => {
        if (!isLoaded || !tokenClient) {
            console.warn('Google Picker scripts not fully loaded yet');
            return;
        }

        setIsLoading(true);

        // 1. Request Access Token
        tokenClient.callback = async (response: any) => {
            if (response.error !== undefined) {
                console.error('OAuth error:', response);
                setIsLoading(false);
                return;
            }

            const accessToken = response.access_token;

            // 2. Build and Show Picker
            if (window.google?.picker) {
                const view = new window.google.picker.View(window.google.picker.ViewId[viewId]);
                view.setMimeTypes('application/vnd.google-apps.spreadsheet');

                const picker = new window.google.picker.PickerBuilder()
                    .addView(view)
                    .setOAuthToken(accessToken)
                    .setDeveloperKey(developerKey)
                    .setCallback((data: any) => {
                        if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
                            const doc = data[window.google.picker.Response.DOCUMENTS][0];
                            onSelect({
                                id: doc[window.google.picker.Document.ID],
                                name: doc[window.google.picker.Document.NAME],
                                accessToken: accessToken,
                            });
                        } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
                            if (onCancel) onCancel();
                        }
                        setIsLoading(false);
                    })
                    .build();

                picker.setVisible(true);
            }
        };

        // Trigger OAuth flow (popup)
        // prompt: '' avoids forcing consent if already granted
        tokenClient.requestAccessToken({ prompt: '' });

    }, [isLoaded, tokenClient, developerKey, viewId, onSelect, onCancel]);

    return { openPicker, isLoaded, isLoading };
}
