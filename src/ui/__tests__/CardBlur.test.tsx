import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text, View } from 'react-native';

import { DEFAULT_LOOK } from '@/theme/look';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

import { Card } from '../Card';
import { renderThemed } from '../testing';

const mockBlur = () => <View testID="blur" />;
jest.mock('expo-blur', () => ({ BlurView: () => mockBlur() }));

describe('Card under Reduce Transparency', () => {
  afterEach(() => jest.restoreAllMocks());

  it('blurs by default', async () => {
    await renderThemed(<Card><Text>x</Text></Card>);
    expect(screen.queryByTestId('blur')).toBeTruthy();
  });

  it('skips the blur but keeps the card when Reduce Transparency is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    await renderThemed(<Card><Text>x</Text></Card>);
    await act(async () => {});
    expect(screen.queryByTestId('blur')).toBeNull();
    expect(screen.getByText('x')).toBeTruthy();
  });
});

describe('ThemeProvider look override', () => {
  it('renders its subtree in the given look instead of the saved one', async () => {
    const Probe = () => <Text>{useTheme().look.pal}</Text>;
    await renderThemed(<ThemeProvider look={{ ...DEFAULT_LOOK, pal: 'sunrise' }}><Probe /></ThemeProvider>);
    expect(screen.getByText('sunrise')).toBeTruthy();
  });
});
