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

function NativeRefTestField({ name, onFocus, fieldRef, expose }) {
  const focus = useCallback(() => onFocus(name), [name, onFocus]);
  const field = useFormNavigationField(focus, true, fieldRef);
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

  it('passes native refs to measureLayout', () => {
    const scrollTo = jest.fn();
    const scrollRef = { current: { scrollTo } };
    const fieldRef = {
      current: {
        measureLayout: jest.fn((relativeTo, onSuccess) => onSuccess(0, 48)),
      },
    };
    let tree;
    let exposedField;

    act(() => {
      tree = create(
        <FormNavigationProvider scrollRef={scrollRef}>
          <NativeRefTestField
            name="native"
            onFocus={jest.fn()}
            fieldRef={fieldRef}
            expose={(field) => { exposedField = field; }}
          />
        </FormNavigationProvider>,
      );
    });

    expect(fieldRef.current.measureLayout).toHaveBeenCalledWith(
      scrollRef.current,
      expect.any(Function),
      expect.any(Function),
    );

    act(() => exposedField.activate());
    expect(scrollTo).toHaveBeenCalledWith({ y: 24, animated: true });

    act(() => tree.unmount());
  });

  it('measures enabled fields and advances in visual y order', () => {
    jest.useFakeTimers();
    const focused = jest.fn();
    const secondRef = {
      current: {
        measureLayout: jest.fn((relativeTo, onSuccess) => onSuccess(0, 80)),
      },
    };
    const firstRef = {
      current: {
        measureLayout: jest.fn((relativeTo, onSuccess) => onSuccess(0, 20)),
      },
    };
    const scrollRef = { current: { scrollTo: jest.fn() } };
    const first = { current: null };
    let tree;

    act(() => {
      tree = create(
        <FormNavigationProvider scrollRef={scrollRef}>
          <NativeRefTestField
            name="first-y"
            onFocus={focused}
            fieldRef={firstRef}
            expose={(field) => { first.current = field; }}
          />
          <NativeRefTestField
            name="second-y"
            onFocus={focused}
            fieldRef={secondRef}
            expose={() => {}}
          />
        </FormNavigationProvider>,
      );
    });

    act(() => {
      secondRef.current.measureLayout.mockClear();
      firstRef.current.measureLayout.mockClear();
      jest.advanceTimersByTime(0);
      expect(first.current.advance()).toBe(true);
      jest.advanceTimersByTime(180);
    });

    expect(focused).toHaveBeenCalledWith('second-y');
    act(() => tree.unmount());
  });
});
