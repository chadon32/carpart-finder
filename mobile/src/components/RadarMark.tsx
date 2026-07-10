import { useEffect, useRef } from 'react'
import { View, Animated, Easing } from 'react-native'

// The brand radar mark, rebuilt with plain Views (no SVG dependency):
// concentric rings + crosshair + a blip, with an optional rotating sweep
// line — the same motif as the website's RadarMark/loading states.
export function RadarMark({ size = 40, color = '#2050c8', sweeping = false }: {
  size?: number
  color?: string
  sweeping?: boolean
}) {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!sweeping) return
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [sweeping, spin])

  const ring = (scale: number, opacity: number) => ({
    position: 'absolute' as const,
    width: size * scale,
    height: size * scale,
    left: (size * (1 - scale)) / 2,
    top: (size * (1 - scale)) / 2,
    borderRadius: (size * scale) / 2,
    borderWidth: Math.max(1.5, size * 0.045),
    borderColor: color,
    opacity,
  })

  return (
    <View style={{ width: size, height: size }}>
      <View style={ring(1, 0.85)} />
      <View style={ring(0.62, 0.5)} />
      {/* crosshair */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: size / 2 - 0.75,
          height: 1.5,
          backgroundColor: color,
          opacity: 0.4,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: size / 2 - 0.75,
          width: 1.5,
          backgroundColor: color,
          opacity: 0.4,
        }}
      />
      {/* blip */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.28,
          left: size * 0.62,
          width: size * 0.14,
          height: size * 0.14,
          borderRadius: size * 0.07,
          backgroundColor: color,
        }}
      />
      {/* sweep: a radius line pivoting around the center */}
      {sweeping && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            transform: [
              {
                rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
              },
            ],
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: size / 2 - 1,
              top: 0,
              width: 2,
              height: size / 2,
              backgroundColor: color,
              opacity: 0.9,
            }}
          />
        </Animated.View>
      )}
    </View>
  )
}
