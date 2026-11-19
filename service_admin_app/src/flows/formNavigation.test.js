import React, { useCallback } from 'react';
import { act, create } from 'react-test-renderer';
import {
  FormNavigationProvider,
  useFormNavigationField,
} from '../components/forms/FormNavigation';

jest.mock('../theme/ThemeContext', () => ({
  useTheme: () => ({
    colors: { primary: '#000000', onAccent: '#ffffff', text: '#000000' },
    radius: { pill: 20 },
    type: { label: {} },
  }),
}));

function TestField({ name, onFocus, enabled = true, expose }) {
  const focus = useCallback(() => onFocus(name), [name, onFocus]);
  const field = useFormNavigationField(focus, enabled);
  expose(field);
  return null;
}

describe('form field navigation', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves focus to the next enabled field in visual order', () => {
    jest.useFakeTimers();
    const focused = jest.fn();
    const first = { current: null };
    let tree;

    act(() => {
      tree = create(
        <FormNavigationProvider>
          <TestField name="first" onFocus={focused} expose={(field) => { first.current = field; }} />
          <TestField name="disabled" onFocus={focused} enabled={false} expose={() => {}} />
          <TestField name="second" onFocus={focused} expose={() => {}} />
        </FormNavigationProvider>,
      );
    });

    expect(first.current.hasNext).toBe(true);
    act(() => {
      expect(first.current.advance()).toBe(true);
      jest.advanceTimersByTime(180);
    });
    expect(focused).toHaveBeenCalledWith('second');

    act(() => tree.unmount());
  });

  it('shows the prompt only when a multi-select activates it', () => {
    jest.useFakeTimers();
    const focused = jest.fn();
    const first = { current: null };
    const second = { current: null };
    let tree;

    act(() => {
      tree = create(
        <FormNavigationProvider>
          <TestField name="first" onFocus={focused} expose={(field) => { first.current = field; }} />
          <TestField name="second" onFocus={focused} expose={(field) => { second.current = field; }} />
          <TestField name="third" onFocus={focused} expose={() => {}} />
        </FormNavigationProvider>,
      );
    });

    const prompt = () => tree.root.findAllByProps({
      accessibilityHint: 'Scroll to and focus the next form field',
    });
    act(() => first.current.activate());
    expect(prompt()).toHaveLength(0);

    act(() => first.current.activate(true));
    expect(prompt().length).toBeGreaterThan(0);

    act(() => {
      const promptButton = prompt().find((node) => typeof node.props.onPress === 'function');
      promptButton.props.onPress();
    });
    expect(prompt()).toHaveLength(0);
    act(() => jest.advanceTimersByTime(180));

    expect(focused).toHaveBeenCalledWith('second');
    expect(prompt()).toHaveLength(0);
    act(() => second.current.activate(true));
    expect(prompt().length).toBeGreaterThan(0);
    act(() => tree.unmount());
  });
});
