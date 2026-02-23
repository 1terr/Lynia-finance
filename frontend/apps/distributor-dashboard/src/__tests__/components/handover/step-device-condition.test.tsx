import { render, screen } from '@/__tests__/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { StepDeviceCondition } from '@/components/handover/step-device-condition';
import { createDeviceCondition } from '@/__tests__/fixtures/factories';

describe('StepDeviceCondition', () => {
  const mockCondition = createDeviceCondition('good');
  const mockOnUpdate = jest.fn();
  const mockOnAppUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders instruction text', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText(/Inspect the device and record its condition/i)).toBeInTheDocument();
    });

    it('renders Physical Condition section', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('PHYSICAL CONDITION')).toBeInTheDocument();
      expect(screen.getByText('Screen Condition')).toBeInTheDocument();
      expect(screen.getByText('Body Condition')).toBeInTheDocument();
    });

    it('renders Functionality Checks section', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('FUNCTIONALITY CHECKS')).toBeInTheDocument();
      expect(screen.getByText('Powers On')).toBeInTheDocument();
      expect(screen.getByText('Touch Responsive')).toBeInTheDocument();
      expect(screen.getByText('Buttons Work')).toBeInTheDocument();
      expect(screen.getByText('Ports Work')).toBeInTheDocument();
    });

    it('renders App & Lock Setup section', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('APP & LOCK SETUP')).toBeInTheDocument();
      expect(screen.getByText(/Install the Lynia app/i)).toBeInTheDocument();
    });

    it('renders Accessories Included section', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('ACCESSORIES INCLUDED')).toBeInTheDocument();
    });

    it('renders Additional Notes field', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('Additional Notes (optional)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Any additional observations/i)).toBeInTheDocument();
    });
  });

  describe('Physical Condition Ratings', () => {
    it('renders all rating options (Excellent, Good, Fair, Poor)', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const excellentButtons = screen.getAllByText('Excellent');
      const goodButtons = screen.getAllByText('Good');
      const fairButtons = screen.getAllByText('Fair');
      const poorButtons = screen.getAllByText('Poor');

      expect(excellentButtons.length).toBeGreaterThan(0);
      expect(goodButtons.length).toBeGreaterThan(0);
      expect(fairButtons.length).toBeGreaterThan(0);
      expect(poorButtons.length).toBeGreaterThan(0);
    });

    it('updates screen condition when rating is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const excellentButtons = screen.getAllByText('Excellent');
      await user.click(excellentButtons[0]);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ screen_condition: 'excellent' })
      );
    });

    it('updates body condition when rating is clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const poorButtons = screen.getAllByText('Poor');
      await user.click(poorButtons[1]);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ body_condition: 'poor' })
      );
    });
  });

  describe('Functionality Checks', () => {
    it('displays all 8 functionality checks', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('Powers On')).toBeInTheDocument();
      expect(screen.getByText('Touch Responsive')).toBeInTheDocument();
      expect(screen.getByText('Buttons Work')).toBeInTheDocument();
      expect(screen.getByText('Ports Work')).toBeInTheDocument();
      expect(screen.getByText('Cameras Work')).toBeInTheDocument();
      expect(screen.getByText('Wi-Fi Works')).toBeInTheDocument();
      expect(screen.getByText('Cellular Works')).toBeInTheDocument();
      expect(screen.getByText('Calls Work')).toBeInTheDocument();
    });

    it('shows PASS for enabled checks', () => {
      const conditionWithPasses = createDeviceCondition('good', {
        powers_on: true,
        touch_responsive: true,
      });

      render(
        <StepDeviceCondition
          condition={conditionWithPasses}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const passLabels = screen.getAllByText('PASS');
      expect(passLabels.length).toBeGreaterThan(0);
    });

    it('shows FAIL for disabled checks', () => {
      const conditionWithFails = createDeviceCondition('good', {
        powers_on: false,
        touch_responsive: false,
      });

      render(
        <StepDeviceCondition
          condition={conditionWithFails}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const failLabels = screen.getAllByText('FAIL');
      expect(failLabels.length).toBeGreaterThan(0);
    });

    it('toggles Powers On when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const powersOnButton = screen.getByText('Powers On').closest('button');
      await user.click(powersOnButton!);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ powers_on: !mockCondition.powers_on })
      );
    });

    it('toggles Wi-Fi Works when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const wifiButton = screen.getByText('Wi-Fi Works').closest('button');
      await user.click(wifiButton!);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ wifi_works: !mockCondition.wifi_works })
      );
    });
  });

  describe('App & Lock Setup', () => {
    it('displays Lynia App Installed toggle', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('Lynia App Installed')).toBeInTheDocument();
    });

    it('displays App Configured toggle', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('App Configured')).toBeInTheDocument();
    });

    it('displays Remote Lock Test Passed toggle', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('Remote Lock Test Passed')).toBeInTheDocument();
    });

    it('toggles app installed when clicked', async () => {
      const user = userEvent.setup();
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const appButton = screen.getByText('Lynia App Installed').closest('button');
      await user.click(appButton!);

      expect(mockOnAppUpdate).toHaveBeenCalledWith({ app_installed: true });
    });

    it('shows warning when app is not installed', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText(/Install the Lynia app on the device before proceeding/i)).toBeInTheDocument();
    });

    it('hides app install warning when app is installed', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={true}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.queryByText(/Install the Lynia app on the device before proceeding/i)).not.toBeInTheDocument();
    });

    it('shows lock test warning when app installed but lock not tested', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={true}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText(/Test the remote lock before handing over the device/i)).toBeInTheDocument();
    });

    it('hides lock test warning when lock test passed', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={true}
          appConfigured={true}
          lockTestPassed={true}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.queryByText(/Test the remote lock/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessories', () => {
    it('displays all accessory options', () => {
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText('charger')).toBeInTheDocument();
      expect(screen.getByText('cable')).toBeInTheDocument();
      expect(screen.getByText('earphones')).toBeInTheDocument();
      expect(screen.getByText('case')).toBeInTheDocument();
      expect(screen.getByText('screen protector')).toBeInTheDocument();
    });

    it('toggles accessory when clicked', async () => {
      const user = userEvent.setup();
      const conditionNoAccessories = createDeviceCondition('good', {
        accessories_included: [],
      });

      render(
        <StepDeviceCondition
          condition={conditionNoAccessories}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const chargerButton = screen.getByText('charger').closest('button');
      await user.click(chargerButton!);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ accessories_included: ['charger'] })
      );
    });

    it('removes accessory when clicked again', async () => {
      const user = userEvent.setup();
      const conditionWithCharger = createDeviceCondition('good', {
        accessories_included: ['charger'],
      });

      render(
        <StepDeviceCondition
          condition={conditionWithCharger}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const chargerButton = screen.getByText('charger').closest('button');
      await user.click(chargerButton!);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ accessories_included: [] })
      );
    });
  });

  describe('Notes', () => {
    it('updates notes when text is entered', async () => {
      const user = userEvent.setup();
      render(
        <StepDeviceCondition
          condition={mockCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const notesTextarea = screen.getByPlaceholderText(/Any additional observations/i);
      await user.type(notesTextarea, 'Device has minor scratch');

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ notes: expect.stringContaining('Device has minor scratch') })
      );
    });

    it('displays existing notes', () => {
      const conditionWithNotes = createDeviceCondition('good', {
        notes: 'Screen has hairline crack',
      });

      render(
        <StepDeviceCondition
          condition={conditionWithNotes}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      const textarea = screen.getByPlaceholderText(/Any additional observations/i);
      expect(textarea).toHaveValue('Screen has hairline crack');
    });
  });

  describe('Validation Warnings', () => {
    it('shows critical warning when device does not power on', () => {
      const brokenCondition = createDeviceCondition('poor', {
        powers_on: false,
      });

      render(
        <StepDeviceCondition
          condition={brokenCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.getByText(/Device must power on to proceed with handover/i)).toBeInTheDocument();
    });

    it('hides warning when device powers on', () => {
      const workingCondition = createDeviceCondition('good', {
        powers_on: true,
      });

      render(
        <StepDeviceCondition
          condition={workingCondition}
          onUpdate={mockOnUpdate}
          appInstalled={false}
          appConfigured={false}
          lockTestPassed={false}
          onAppUpdate={mockOnAppUpdate}
        />
      );

      expect(screen.queryByText(/Device must power on to proceed/i)).not.toBeInTheDocument();
    });
  });
});
