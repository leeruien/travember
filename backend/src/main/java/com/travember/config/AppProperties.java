package com.travember.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(String supabaseUrl, String supabaseJwtSecret, List<String> corsOrigins) {
}
