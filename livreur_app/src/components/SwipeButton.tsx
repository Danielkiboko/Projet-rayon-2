import React, { useRef, useState } from 'react';
import { StyleSheet, Animated, PanResponder, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface SwipeButtonProps {
  /** Retourne false (ou lève une erreur) pour remettre le bouton à zéro */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  title?: string;
  color?: string;
  disabled?: boolean;
}

const BUTTON_HEIGHT = 60;
const THUMB_SIZE = 52;
const THUMB_MARGIN = 4;

export default function SwipeButton({ onConfirm, title = "Glissez pour valider", color = '#38bdf8', disabled = false }: SwipeButtonProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  // Largeur mesurée réellement (s'adapte à la carte qui contient le bouton)
  const maxTranslate = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const reset = () => {
    setState('idle');
    Animated.spring(pan, { toValue: 0, useNativeDriver: false, bounciness: 10 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current === 'idle' && !disabledRef.current,
      onMoveShouldSetPanResponder: () => stateRef.current === 'idle' && !disabledRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        pan.setValue(Math.max(0, Math.min(g.dx, maxTranslate.current)));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > maxTranslate.current * 0.75) {
          setState('loading');
          Animated.timing(pan, { toValue: maxTranslate.current, duration: 120, useNativeDriver: false }).start(async () => {
            try {
              const ok = await onConfirmRef.current();
              if (ok === false) reset();
              else setState('done');
            } catch {
              reset();
            }
          });
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: false, bounciness: 10 }).start();
        }
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    maxTranslate.current = Math.max(0, e.nativeEvent.layout.width - THUMB_SIZE - THUMB_MARGIN * 2 - 2);
  };

  const range = Math.max(maxTranslate.current, 1);
  const textOpacity = pan.interpolate({ inputRange: [0, range / 2], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.container, { backgroundColor: `${color}1A`, borderColor: `${color}55`, opacity: disabled ? 0.5 : 1 }]}
    >
      <Animated.Text style={[styles.title, { opacity: textOpacity }]}>{title}</Animated.Text>
      <Animated.View
        style={[styles.thumb, { backgroundColor: state === 'done' ? '#22c55e' : color, shadowColor: color, transform: [{ translateX: pan }] }]}
        {...panResponder.panHandlers}
      >
        {state === 'loading' ? (
          <ActivityIndicator color="#0b061c" />
        ) : (
          <FontAwesome5 name={state === 'done' ? 'check' : 'chevron-right'} size={20} color="#0b061c" />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BUTTON_HEIGHT,
    width: '100%',
    borderRadius: BUTTON_HEIGHT / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    position: 'absolute',
    zIndex: 1,
  },
  thumb: {
    height: THUMB_SIZE,
    width: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    left: THUMB_MARGIN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 2,
  },
});
