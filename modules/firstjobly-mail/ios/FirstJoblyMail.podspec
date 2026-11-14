Pod::Spec.new do |s|
  s.name = 'FirstJoblyMail'
  s.version = '1.0.0'
  s.summary = 'Multi-document application handoff'
  s.description = 'FirstJobly local UIKit activity sheet for reviewed application attachments.'
  s.license = { :type => 'MIT' }
  s.author = 'FirstJobly'
  s.homepage = 'https://firstjobly.co.za'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
