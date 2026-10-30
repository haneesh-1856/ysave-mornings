import { View } from 'react-native';

import { T } from './T';

type Props = { value: string; caption: string };

/** The 70/800 tabular countdown number with its caption ("12" / "min left"). */
export function BigNumber({ value, caption }: Props) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${value} ${caption}`} style={{ alignItems: 'center' }}>
      <T variant="big" importantForAccessibility="no">{value}</T>
      <T variant="sub" importantForAccessibility="no">{caption}</T>
    </View>
  );
}
