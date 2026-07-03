import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  token,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de confirmação: {token ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>{siteName}</Text>
        </Section>
        <Heading style={h1}>Confirme seu cadastro</Heading>
        <Text style={text}>
          Obrigado por criar sua conta na{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Use o código de 6 dígitos abaixo para confirmar o seu e-mail (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) no aplicativo:
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{token}</Text>
        </Section>
        <Text style={text}>
          Digite este código na tela de confirmação. Ele é válido por tempo
          limitado — se expirar, solicite um novo pelo botão “Reenviar código”.
        </Text>
        <Text style={footer}>
          Se você não criou esta conta, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const BRAND = '#E1523D'
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '520px' }
const brandBar = { padding: '0 0 16px', borderBottom: `2px solid ${BRAND}`, marginBottom: '24px' }
const brandText = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: BRAND,
  margin: '0',
  letterSpacing: '0.5px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1f2937',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
const link = { color: BRAND, textDecoration: 'underline' }
const codeBox = {
  backgroundColor: '#fbeae7',
  border: `1px solid ${BRAND}`,
  borderRadius: '12px',
  padding: '18px 24px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}
const codeText = {
  fontSize: '34px',
  fontWeight: 'bold' as const,
  color: BRAND,
  letterSpacing: '10px',
  margin: '0',
  fontFamily: 'Courier New, Courier, monospace',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
