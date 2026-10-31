import { act, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderThemed } from '@/ui/testing';

import { ThemeProvider, useLookStore, useTheme } from '../ThemeProvider';

let mockLowEnd = true;
jest.mock('@/state/device', () => ({ isLowEndDevice: () => mockLowEnd }));

function Probe() {
  const t = useTheme();
  return <Text>{`blur:${t.glass?.blur} default:${t.lowEndDefault}`}</Text>;
}

beforeEach(() => {
  mockLowEnd = true;
  useLookStore.setState({ blurChosen: false });
});

describe('glass blur default on low-end devices', () => {
  it('is off when the user never chose a blur level', async () => {
    await renderThemed(<Probe />);
    expect(screen.getByText('blur:false default:true')).toBeTruthy();
  });

  it('comes back once the user has chosen a level', async () => {
    await renderThemed(<Probe />);
    await act(async () => useLookStore.setState({ blurChosen: true }));
    expect(screen.getByText('blur:true default:false')).toBeTruthy();
  });

  it('a blurChosen override (the Glass preview draft) turns it on for that subtree only', async () => {
    await renderThemed(<ThemeProvider blurChosen><Probe /></ThemeProvider>);
    expect(screen.getByText('blur:true default:false')).toBeTruthy();
  });

  it('is on for a normal device (and on iOS, where detection is false)', async () => {
    mockLowEnd = false;
    await renderThemed(<Probe />);
    expect(screen.getByText('blur:true default:false')).toBeTruthy();
  });
});
