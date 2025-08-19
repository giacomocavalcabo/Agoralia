// Error handling utility per la KB
export const KB_ERRORS = {
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  FORBIDDEN: 403,
  NOT_FOUND: 404
};

export function getKBErrorMessage(error) {
  const status = error?.status || error?.response?.status;
  const details = error?.response?.data?.details;
  
  switch (status) {
    case KB_ERRORS.VALIDATION:
      return {
        title: 'Errore di Validazione',
        message: 'Controlla il mapping dei campi e riprova',
        details: details || 'I dati inseriti non sono validi',
        action: 'Correggi e riprova'
      };
      
    case KB_ERRORS.CONFLICT:
      return {
        title: 'Conflitto Rilevato',
        message: 'Conflitto/lock: riprova tra poco',
        details: details || 'Un\'altra operazione è in corso',
        action: 'Riprova',
        retry: true
      };
      
    case KB_ERRORS.RATE_LIMIT:
      return {
        title: 'Limite Raggiunto',
        message: 'Hai raggiunto il limite: attendi o aumenta il cap',
        details: details || 'Troppe richieste in poco tempo',
        action: 'Attendi e riprova',
        retry: true
      };
      
    case KB_ERRORS.FORBIDDEN:
      return {
        title: 'Accesso Negato',
        message: 'Non hai i permessi per questa operazione',
        details: details || 'Contatta l\'amministratore',
        action: 'Richiedi accesso'
      };
      
    case KB_ERRORS.NOT_FOUND:
      return {
        title: 'Risorsa Non Trovata',
        message: 'La risorsa richiesta non esiste',
        details: details || 'Verifica l\'ID o l\'URL',
        action: 'Verifica e riprova'
      };
      
    default:
      return {
        title: 'Errore Imprevisto',
        message: 'Si è verificato un errore inaspettato',
        details: details || 'Riprova più tardi',
        action: 'Riprova',
        retry: true
      };
  }
}

export function isRetryableError(error) {
  const status = error?.status || error?.response?.status;
  return [KB_ERRORS.CONFLICT, KB_ERRORS.RATE_LIMIT].includes(status);
}
