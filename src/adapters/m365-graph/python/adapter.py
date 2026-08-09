"""
Python example adapter for Microsoft Graph delta queries and change notifications
Requirements:
  pip install msal requests flask

This sample demonstrates:
- Acquiring an app token with MSAL (client credentials)
- Running an initial delta query for list items
- Exposing a Flask endpoint for notifications (validation and POST handling)
- Simple in-memory replay protection and deltaLink persistence

Note: For production use persistent storage and secure secret management.
"""

import os
import time
import threading
import requests
from msal import ConfidentialClientApplication
from flask import Flask, request, Response

TENANT_ID = os.environ.get('AZURE_TENANT_ID', '<tenant-id>')
CLIENT_ID = os.environ.get('AZURE_CLIENT_ID', '<client-id>')
CLIENT_SECRET = os.environ.get('AZURE_CLIENT_SECRET', '<client-secret>')
EXPECTED_CLIENT_STATE = os.environ.get('EXPECTED_CLIENT_STATE', 'my-secret-client-state')
SITE_ID = os.environ.get('SITE_ID', '<site-id>')
LIST_ID = os.environ.get('LIST_ID', '<list-id>')

AUTHORITY = f'https://login.microsoftonline.com/{TENANT_ID}'
SCOPE = ['https://graph.microsoft.com/.default']

# In-memory stores; replace with DB/cache in production
persisted_delta_link = None
recent_notification_ids = {}
NOTIFICATION_WINDOW_S = 60 * 60

app = Flask(__name__)

client_app = ConfidentialClientApplication(CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET)


def get_access_token():
    resp = client_app.acquire_token_for_client(scopes=SCOPE)
    if 'access_token' not in resp:
        raise RuntimeError('Failed to acquire token: %s' % resp)
    return resp['access_token']


def initial_delta_sync():
    global persisted_delta_link
    token = get_access_token()
    headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
    url = f'https://graph.microsoft.com/v1.0/sites/{SITE_ID}/lists/{LIST_ID}/items/delta?$select=id,fields'
    print('Starting initial delta sync', url)
    while url:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()
        for item in data.get('value', []):
            print('Item change:', item.get('id'), item.get('fields'))
        if '@odata.nextLink' in data:
            url = data['@odata.nextLink']
            continue
        if '@odata.deltaLink' in data:
            persisted_delta_link = data['@odata.deltaLink']
            print('Persisted deltaLink:', persisted_delta_link)
            break
        break


def poll_delta_link():
    global persisted_delta_link
    if not persisted_delta_link:
        print('No deltaLink found')
        return
    token = get_access_token()
    headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
    url = persisted_delta_link
    print('Polling deltaLink', url)
    while url:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()
        for item in data.get('value', []):
            print('Delta item:', item.get('id'))
        if '@odata.nextLink' in data:
            url = data['@odata.nextLink']
            continue
        if '@odata.deltaLink' in data:
            persisted_delta_link = data['@odata.deltaLink']
            print('Updated deltaLink:', persisted_delta_link)
            break
        break


# Simple cleanup and replay protection

def cleanup_old_notifications():
    cutoff = time.time() - NOTIFICATION_WINDOW_S
    to_delete = [k for k, v in recent_notification_ids.items() if v < cutoff]
    for k in to_delete:
        del recent_notification_ids[k]


def is_replay(notification_id):
    cleanup_old_notifications()
    return notification_id in recent_notification_ids


def mark_processed(notification_id):
    recent_notification_ids[notification_id] = time.time()


@app.route('/api/notifications', methods=['GET'])
def validate():
    validation_token = request.args.get('validationToken')
    if validation_token:
        # Reply with plain text token
        return Response(validation_token, status=200, mimetype='text/plain')
    return Response('Missing validationToken', status=400)


@app.route('/api/notifications', methods=['POST'])
def notifications():
    data = request.get_json()
    if not data or 'value' not in data:
        return Response('Bad request', status=400)

    for notification in data['value']:
        nid = notification.get('id')
        client_state = notification.get('clientState')

        if EXPECTED_CLIENT_STATE and client_state != EXPECTED_CLIENT_STATE:
            print('clientState mismatch, ignoring')
            continue
        if is_replay(nid):
            print('Duplicate notification', nid)
            continue
        mark_processed(nid)
        print('Received notification', notification.get('subscriptionId'), notification.get('resource'))
        # Trigger background task to poll delta link or reconcile state

    return Response(status=202)


if __name__ == '__main__':
    # Start Flask dev server for local testing
    # Run initial sync in background thread for convenience
    threading.Thread(target=lambda: initial_delta_sync()).start()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
