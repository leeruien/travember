package com.travember;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class TravemberApplication {

    public static void main(String[] args) {
        SpringApplication.run(TravemberApplication.class, args);
    }
}
