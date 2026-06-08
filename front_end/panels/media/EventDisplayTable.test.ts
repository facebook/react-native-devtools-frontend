// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {assert} from 'chai';

import {describeWithEnvironment} from '../../testing/EnvironmentHelpers.js';

import * as Media from './media.js';

describeWithEnvironment('EventDisplayTable', () => {
  it('correctly displays the timestamp for events', () => {
    const eventDisplayTable = new Media.PlayerEventsView.PlayerEventsView();
    const event1 = {
      timestamp: 1000,
      value: JSON.stringify({event: 'testEvent', data: 'data1'}),
    } as Media.MediaModel.PlayerEvent;

    eventDisplayTable.onEvent(event1);

    const rootNode = (eventDisplayTable as unknown & {
                       dataGrid: {
                         rootNode: () => {
                           children: Media.PlayerEventsView.EventNode[],
                         },
                       },
                     }).dataGrid.rootNode();
    assert.lengthOf(rootNode.children, 1);

    const firstNode = rootNode.children[0] as Media.PlayerEventsView.EventNode;

    // Verify the data property is set correctly
    assert.strictEqual(firstNode.data['displayTimestamp'], '0.000');

    // Verify the cell is created with the correct content for the 'displayTimestamp' column
    const cell = firstNode.createCell('displayTimestamp');
    assert.strictEqual(cell.textContent, '0.000');
  });

  it('subtracts the first event time from subsequent events', () => {
    const eventDisplayTable = new Media.PlayerEventsView.PlayerEventsView();
    const event1 = {
      timestamp: 1000,
      value: JSON.stringify({event: 'testEvent', data: 'data1'}),
    } as Media.MediaModel.PlayerEvent;

    const event2 = {
      timestamp: 1234.5678,
      value: JSON.stringify({event: 'testEvent2', data: 'data2'}),
    } as Media.MediaModel.PlayerEvent;

    eventDisplayTable.onEvent(event1);
    eventDisplayTable.onEvent(event2);

    const rootNode = (eventDisplayTable as unknown & {
                       dataGrid: {
                         rootNode: () => {
                           children: Media.PlayerEventsView.EventNode[],
                         },
                       },
                     }).dataGrid.rootNode();
    const secondNode = rootNode.children[1] as Media.PlayerEventsView.EventNode;

    assert.strictEqual(secondNode.data['displayTimestamp'], '234.568');
  });
});
