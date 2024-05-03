---
title: "Ressurection of an RC car"
date: 2024-05-03T22:30:00+01:00
description: "Resurrecting a +10 year old rc car from my childhood."
tags: ["hardware"]
type: post
weight: 0
showTableOfContents: true
---

## How to resurrect an RC car?

Here's a short story / post about me rebuilding an old RC car.

### All parts used

- Generic Male-Male Jumper Wires
- Generic Male-Female Jumper Wires
- [Small 400 Pins Breadboard](https://botland.store/breadoards/19942-breadboard-justpi-400-holes-5904422328627.html)
- [Step-down Voltage Converter LM2596](https://botland.store/converters-step-down/2967-step-down-voltage-inverter-lm2596-32v-35v-3a-5903351241397.html)
- [4s 1500mAh CNHL LiPo Battery](https://chinahobbyline.com/collections/cnhl-voltage-14-8v-4s-lipo-batteries/products/cnhl-black-series-1500mah-14-8v-4s-100c-lipo-battery-with-xt60-plug)
- [XT60 Connector](https://botland.store/wires-and-power-connectors/7515-xt60-plug-with-cable-10cm-5904422310493.html)
- [Cytron Maker Drive](https://botland.store/motor-drivers-modules/13999-cytron-maker-drive-mx1508-two-channel-motor-controller-95v1a-5904422321802.html)
- [Raspberry Pi Pico](https://botland.store/raspberry-pi-pico-modules-and-kits/18767-raspberry-pi-pico-rp2040-arm-cortex-m0-0617588405587.html)
- [ER5A ELRS Receiver](https://www.radiomasterrc.com/products/er5a-elrs-pwm-receiver?variant=46464193462503)
- Unnamed cheap Chinese Bentley RC car :P

All of above are visible on the image.

### Components and wiring

I'll admit it that I'm too lazy to make a simple wiring diagram... I guess that the most interesting thing about it is the battery circuit. 

The 4S LiPo battery is connected via an XT60 connector to the power converter that steps down the voltage down to 9V which is the max input voltage of the motor driver board. Everything after is pretty self-explanatory since there are only two motors and two RX channels.

![caropen](/images/caropen.jpg)

### Aliexpress can sometimes betray you

In the beginning I wanted to use a "high-power" power converter I've gotten from Aliexpress before. I thought that such a big and powerful power converter has no way of failing me. On the aliexpress product page it said that it is rated for 200W which is an absolute overkill for this project but who said that I can't use it?

Then I noticed a really weird behaviour. As soon as I applied any throttle or tried to steer the car, the output voltage from the power converter would drastically drop from 9V to 2V or even lower effectively "restarting" the car.

Turned out that my Aliexpress "high-power" power converter was faulty. That was the first time Aliexpress betrayed me.

![caropen](/images/powerconverter.png)

## Radio Control

In order to control the car I used the before mentioned [ER5A ELRS Receiver](https://www.radiomasterrc.com/products/er5a-elrs-pwm-receiver?variant=46464193462503) and my FPV drone radio [(JumperRC T-Lite V2 2.4GHz)](https://oscarliang.com/jumper-t-lite-v2/). Both use the amazing [ELRS protocol](https://www.expresslrs.org/).

### RX Failsafe

Obviously, in an RC car you need some kind of a failsafe system in case it loses connection. Luckily ELRS does that already for us, just not by default. By default when the receiver goes into failsafe mode, it sets channel 3 (throttle) to 988μs instead of 1500μs which is the correct zero-value for the car. 

988 most likely originated from the fact that most people use ELRS receivers for aerial vehicles such as drones or planes and those usually can accelerate only forward 0 -> 1, not -1 -> 1 like my car. 

Therefore all I needed to do is to change the failsafe value to previously mentioned 1500μs.


![pwmfailsafe](/images/pwmfailsafe.png)

### The code behind it

First, PWM is initialised on 4 pins since each engine channel (look at the [motor driver](https://botland.store/motor-drivers-modules/13999-cytron-maker-drive-mx1508-two-channel-motor-controller-95v1a-5904422321802.html)) has two inputs:

```c
constexpr std::array<uint32_t, 4> pwm_pins {
    ACCEL_MOTOR_A,
    ACCEL_MOTOR_B,
    STEER_MOTOR_A,
    STEER_MOTOR_B
};

pwm_config cfg = pwm_get_default_config();
pwm_config_set_clkdiv(&cfg, 16.0f);
pwm_config_set_wrap(&cfg, 500u); // 500 makes servo signals easier to work with

for(const auto& pin : pwm_pins) {
    gpio_set_function(pin, GPIO_FUNC_PWM);
    pwm_init(pwm_gpio_to_slice_num(pin), &cfg, true);
}
```

PWM wrap 500 is easier to work with because of the fact that 50hz servo pulses range from 1000μs to 2000μs. Knowing this, we also know that 50% is 1500μs therefore the signal can only change by 500μs in both directions. This way we can use the integer pulse length relative to 1500μs in order to drive the PWM output.

We also need to initialise the input pins in order to read servo signals coming from the ELRS receiver:

```c
gpio_init(IN_ACCEL);
gpio_set_dir(IN_ACCEL, GPIO_IN);

gpio_init(IN_STEER);
gpio_set_dir(IN_STEER, GPIO_IN);
```

And now the ***fun*** part - the main loop:


```c
bool accel_last_state{};
bool steer_last_state{};

while(1) {
    bool accel_state = gpio_get(IN_ACCEL);
    bool steer_state = gpio_get(IN_STEER);
    
    if(steer_state && !steer_last_state) {
        steer_start_time = time_us_64();
    } else if(!steer_state && steer_last_state) {
        uint64_t steer_val = (time_us_64() - steer_start_time);
        
        // Make sure we only have valid pulse lengths (1000us - 2000us)
        if(steer_val < 2100ull && steer_val > 900ull) {
            if(steer_val < 1000ull) {
                steer_val = 1000ull;
            } else if(steer_val > 2000ull) {
                steer_val = 2000ull;
            }  

            set_motor((uint32_t)steer_val, STEER_MOTOR_A, STEER_MOTOR_B);
        }
    }

    if(accel_state && !accel_last_state) {
        accel_start_time = time_us_64();
    } else if(!accel_state && accel_last_state) {
        uint64_t accel_val = (time_us_64() - accel_start_time);
        
        // Make sure we only have valid pulse lengths
        if(accel_val < 2100ull && accel_val > 900ull) {
            if(accel_val < 1000ull) {
                accel_val = 1000ull;
            } else if(accel_val > 2000ull) {
                accel_val = 2000ull;
            }  

            set_motor((uint32_t)accel_val, ACCEL_MOTOR_A, ACCEL_MOTOR_B);
        }
    }

    sleep_us(5u);

    accel_last_state = accel_state;
    steer_last_state = steer_state;
}
```

I know it's a lot to cover at once, but for now just focus on how the steering pulse works - acceleration works identically. 

Every 5μs the `IN_STEER` pin is checked whether it reads high or low and the value is stored for later. At this point we also have the last state of the pin (from the previous tick).

Since PWM signal is a square wave it only has two interesting points - the beginning and the end:

![pwm](/images/PWM.svg)

We can see that the pulse starts when the last state was low and the current state is high. We can also see that the pulse ends identically but with the states reversed. With this knowledge it is trivially simple to detect those two events:

```c
bool steer_state = gpio_get(IN_STEER);

(...)

if(steer_state && !steer_last_state) {
    steer_start_time = time_us_64();
} else if(!steer_state && steer_last_state) {
    uint64_t steer_val = (time_us_64() - steer_start_time);
        
    // Make sure we only have valid pulse lengths (1000us - 2000us with a margin error)
    if(steer_val < 2100ull && steer_val > 900ull) {
        if(steer_val < 1000ull) {
            steer_val = 1000ull;
        } else if(steer_val > 2000ull) {
            steer_val = 2000ull;
        }  

        set_motor((uint32_t)steer_val, STEER_MOTOR_A, STEER_MOTOR_B);
    }
}

(...)

sleep_us(5u);

(...)

steer_last_state = steer_state;
```

The if statement has two paths:
- Pulse start:
    - Saves the pulse absolute start time in microseconds.
- Pulse end:
    - Gets the pulse length in microseconds by subtracting the pulse start time from the current absolute time. Verifies and clamps the value and finally updates the motor with a new value.


Speaking of updating motors, here's the function responsible for it:
```c
// 1000 <= x <= 2000
void set_motor(uint32_t x, uint32_t pin_a, uint32_t pin_b) {
    if(x > 1500u) {
        pwm_set_gpio_level(pin_a, x - 1500u); 
        pwm_set_gpio_level(pin_b, 0u); 
    } else if(x < 1500u) {
        pwm_set_gpio_level(pin_a, 0u); 
        pwm_set_gpio_level(pin_b, 1500u - x); 
    } else {
        pwm_set_gpio_level(pin_a, 0u); 
        pwm_set_gpio_level(pin_b, 0u); 
    }
}
```
It just sets pwm levels based on the input value `x`. `x` is the PWM pulse length in microseconds. Since both acceleration and steering go from -1 to 1 the midpoint is 0 (1500μs). The function has to switch between `pin_a` and `pin_b` because of how the driver works. Input "A" drives the engine in one direction and input "B" drives the engine in the opposite direction.

## Summary

I guess that's all it takes to resurrect an RC car.

It now drives like a charm and on max power it can also *drift*:


![drift](/images/car.gif)