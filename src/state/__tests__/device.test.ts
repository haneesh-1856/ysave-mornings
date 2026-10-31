import { Platform } from 'react-native';

import { isLowEndDevice } from '../device';

const mockDevice: { totalMemory: number | null; deviceYearClass: number | null } = { totalMemory: null, deviceYearClass: null };
jest.mock('expo-device', () => ({
  get totalMemory() { return mockDevice.totalMemory; },
  get deviceYearClass() { return mockDevice.deviceYearClass; },
}));

const GIB = 1024 ** 3;
const setOs = (os: 'android' | 'ios' | 'web') => { Platform.OS = os; };

beforeEach(() => {
  setOs('android');
  mockDevice.totalMemory = null;
  mockDevice.deviceYearClass = null;
});
afterAll(() => setOs('ios'));

describe('isLowEndDevice', () => {
  it('is true on Android under 3 GiB of memory', () => {
    mockDevice.totalMemory = 2 * GIB;
    expect(isLowEndDevice()).toBe(true);
  });
  it('is false on Android with 3 GiB or more', () => {
    mockDevice.totalMemory = 3 * GIB;
    mockDevice.deviceYearClass = 2021;
    expect(isLowEndDevice()).toBe(false);
  });
  it('is true on Android with a year class before 2019 when memory is unknown', () => {
    mockDevice.deviceYearClass = 2016;
    expect(isLowEndDevice()).toBe(true);
  });
  it('is false when nothing is known', () => {
    expect(isLowEndDevice()).toBe(false);
  });
  it('is false on iOS and web even for tiny numbers', () => {
    mockDevice.totalMemory = 1 * GIB;
    mockDevice.deviceYearClass = 2012;
    setOs('ios');
    expect(isLowEndDevice()).toBe(false);
    setOs('web');
    expect(isLowEndDevice()).toBe(false);
  });
});
